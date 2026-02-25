const leadsService = require("../services/leads.service");
const { successResponse, errorResponse } = require("../helper/response");

exports.createLead = async (req, res) => {
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
    } else if (result.emailExists) {
      return errorResponse(res, 409, result.message, {
        emailExists: true,
        existingLead: result.existingLead,
      });
    } else if (result.nameExists) {
      return errorResponse(res, 409, result.message, {
        nameExists: true,
        existingLead: result.existingLead,
      });
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Create lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.forceCreateLead = async (req, res) => {
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
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Force create lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getAllLeads = async (req, res) => {
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
      outcome: req.query.outcome,
      rating: req.query.rating,
      leadSourceId: req.query.leadSourceId,
      clientTypeId: req.query.clientTypeId,
      regionId: req.query.regionId,
      assigneeId: req.query.assigneeId,
      search: req.query.search,
    };

    const result = await leadsService.getAllLeads(builderId, companyId, filters);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Get all leads error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getLeadById = async (req, res) => {
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
    } else {
      return errorResponse(res, 404, result.message);
    }
  } catch (error) {
    console.error("Get lead by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.updateLead = async (req, res) => {
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
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Update lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.deleteLead = async (req, res) => {
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
    } else {
      return errorResponse(res, 404, result.message);
    }
  } catch (error) {
    console.error("Delete lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getLeadStats = async (req, res) => {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    const result = await leadsService.getLeadStats(builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Get lead stats error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { leads_id } = req.params;
    const { status } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;

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
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Update lead status error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.assignLead = async (req, res) => {
  try {
    const { leads_id } = req.params;
    const { assigneeId } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    if (!assigneeId) {
      return errorResponse(res, 400, "Assignee ID is required");
    }

    const result = await leadsService.assignLead(
      leads_id,
      assigneeId,
      userId,
      builderId,
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Assign lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};
