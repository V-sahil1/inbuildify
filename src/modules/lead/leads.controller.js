import leadsService from "./leads.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";

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

    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 25,
      status: req.query.status,
      rating: req.query.rating,
      lead_source_id: req.query.lead_source_id,
      client_type_id: req.query.client_type_id,
      region_id: req.query.region_id,
      assignee_id: req.query.assignee_id,
      search: req.query.search,
      created_at: req.query.created_at,
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

    const result = await leadsService.updateLead(
      leads_id,
      req.body,
      userId,
      builderId,
      companyId,
    );

    if (result.success) {
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
