import leadsService from "./leads.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";

export async function createLead(req, res) {
  try {
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    // Handle both forceCreate (before middleware) and force_create (after middleware)
    const forceCreate =
      req.body.forceCreate === true ||
      req.body.forceCreate === "true" ||
      req.body.force_create === true ||
      req.body.force_create === "true";

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    const result = await leadsService.createLead(
      req.body,
      userId,
      builderId,
      companyId,
      forceCreate,
    );

    if (result.success) {
      await logActivity(null, {
        userId,
        leadsId: result.data.leadsId,
        module: "Lead",
        moduleId: result.data.leadsId,
        recordName: result.data.name,
        action: "CREATE",
        description: `Lead created: ${result.data.name}`
      });
      return successResponse(res, result.data, result.message);
    } if (result.emailExists) {
      return errorResponse(res, 409, result.message, {
        emailExists: true,
        existingLead: result.existingLead,
      });
    } if (result.nameExists) {
      return errorResponse(res, 409, result.message, {
        nameExists: true,
        existingLead: result.existingLead,
      });
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Create lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function forceCreateLead(req, res) {
  try {
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    const result = await leadsService.createLead(
      req.body,
      userId,
      builderId,
      companyId,
      true,
    );

    if (result.success) {
      await logActivity(null, {
        userId,
        leadsId: result.data.leadsId,
        module: "Lead",
        moduleId: result.data.leadsId,
        recordName: result.data.name,
        action: "CREATE",
        description: `Lead created: ${result.data.name}`
      });
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Force create lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function getAllLeads(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const toArray = (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      return String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 25,
      status: req.query.status,
      rating: toArray(req.query.rating),
      lead_source_id: toArray(req.query.lead_source_id),
      client_type_id: req.query.client_type_id,
      region_id: req.query.region_id,
      assignee_id: toArray(req.query.assignee_id),
      search: req.query.search,
      created_at: req.query.created_at,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
    };

    const result = await leadsService.getAllLeads(builderId, companyId, filters);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Get all leads error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function getLeadById(req, res) {
  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const result = await leadsService.getLeadById(leads_id, builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 404, result.message);

  } catch (error) {
    console.error("Get lead by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function updateLead(req, res) {
  try {
    const { leads_id } = req.params;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    const existingLeadResult = await leadsService.getLeadById(leads_id, builderId, companyId);
    if (!existingLeadResult.success) {
      return errorResponse(res, 404, "Lead not found");
    }

    if (req.file) {
      const activeEngineerId = req.body.structure_engineer_id || existingLeadResult.data.structureEngineerId;
      if (!activeEngineerId) {
        return errorResponse(res, 400, "Structure Engineer is required to upload a structure report.");
      }

      const oldFileUrl = existingLeadResult.data.structureReportFile;
      if (oldFileUrl) {
        await deleteFromS3(oldFileUrl);
      }
      req.body.structure_report_file = req.file.location;
    }

    const result = await leadsService.updateLead(
      leads_id,
      req.body,
      userId,
      builderId,
      companyId,
    );

    if (result.success) {
      await compareAndLogUpdates(null, {
        userId,
        leadsId: leads_id,
        module: "Lead",
        moduleId: leads_id,
        recordName: result.data.name,
        oldData: existingLeadResult.data,
        newData: result.data
      });
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Update lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function deleteLead(req, res) {
  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const existingLeadResult = await leadsService.getLeadById(leads_id, builderId, companyId);
    
    if (!existingLeadResult.success) {
      return errorResponse(res, 404, "Lead not found");
    }

    // Log activity BEFORE deletion to avoid foreign key vibration on ACTIVITY LOG Table
    await logActivity(null, {
      userId: req.user?.users_id,
      leadsId: leads_id,
      module: "Lead",
      moduleId: leads_id,
      recordName: existingLeadResult.data.name,
      action: "DELETE",
      description: `Lead deleted: ${existingLeadResult.data.name}`
    });

    const result = await leadsService.deleteLead(leads_id, builderId, companyId);

    if (result.success) {
      return successResponse(res, null, "Lead deleted successfully");
    }
    return errorResponse(res, 404, result.message);

  } catch (error) {
    console.error("Delete lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function convertLeadToOpportunity(req, res) {
  try {
    const { leads_id } = req.params;
    const { opportunity_notes } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const result = await leadsService.convertLeadToOpportunity(
      leads_id,
      opportunity_notes,
      builderId,
      companyId,
    );

    if (result.success) {
      return successResponse(res, result.data, 201, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Convert lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function getLeadStats(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const result = await leadsService.getLeadStats(builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Get lead stats error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function getSalesDashboard(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const {
      user_id,
      created_at,
      created_at_from,
      created_at_to,
    } = req.query;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const filters = {
      userId: user_id && user_id !== "all" ? user_id : null,
      createdAt: created_at || null,
      createdAtFrom: created_at_from || null,
      createdAtTo: created_at_to || null,
    };

    const result = await leadsService.getSalesDashboard(builderId, filters);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Get sales dashboard error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function updateLeadStatus(req, res) {
  try {
    const { leads_id } = req.params;
    const { status } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    if (!status) {
      return errorResponse(res, 400, "Status is required");
    }

    const result = await leadsService.updateLeadStatus(
      leads_id,
      status,
      userId,
      builderId,
      companyId,
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Update lead status error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function assignLead(req, res) {
  try {
    const { leads_id } = req.params;
    const { assignee_id, assignee_note } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    if (!assignee_id) {
      return errorResponse(res, 400, "Assignee ID is required");
    }

    const result = await leadsService.assignLead(
      leads_id,
      assignee_id,
      assignee_note,
      userId,
      builderId,
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    console.error("Assign lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export const removeHLPackage = async (req, res) => {
  try {
    const { leads_id } = req.params;
    const { remove_hl_package_lot_quotation } = req.body;
    const { users_id, builder_id, company_id } = req.user;

    const result = await leadsService.removeHLPackage(
      leads_id,
      { remove_hl_package_lot_quotation },
      builder_id,
      company_id
    );

    if (result.success) {
      return successResponse(res, null, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Remove HL Package error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

export async function getAllLeadActions(req, res) {
  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const result = await leadsService.getAllLeadActions(leads_id, builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 404, result.message);

  } catch (error) {
    console.error("Get all lead actions error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function getLeadActivityLog(req, res) {
  try {
    const { leads_id } = req.params;
    const { module, action, search, page = 1, limit = 20 } = req.query;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const result = await leadsService.getLeadActivityLog(leads_id, builderId, companyId, {
      module,
      action,
      search,
      limit: limitValue,
      offset,
      page: pageValue
    });

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 404, result.message);

  } catch (error) {
    console.error("Get lead activity log error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

