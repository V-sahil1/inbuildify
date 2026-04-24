import quotationService from "./quotation.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";

export async function getAllQuotations(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      statuses = '',
      leadIds = '',
      contactIds = '',
      startDate = '',
      endDate = '',
      sortBy = '',
      sortOrder = '',
    } = req.query;
    const statusList = Array.isArray(statuses)
      ? statuses
      : String(statuses || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
    const leadIdList = Array.isArray(leadIds)
      ? leadIds
      : String(leadIds || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
    const contactIdList = Array.isArray(contactIds)
      ? contactIds
      : String(contactIds || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

    const result = await quotationService.getAllQuotations(builderId, companyId, {
      page,
      limit,
      search,
      status,
      statuses: statusList,
      leadIds: leadIdList,
      contactIds: contactIdList,
      startDate,
      endDate,
      sortBy: String(sortBy || ''),
      sortOrder: String(sortOrder || ''),
    });

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function getQuotationFilterOptions(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.getQuotationFilterOptions(builderId, companyId);
    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function getQuotationStatusCounts(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.getQuotationCountsByStatus(builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function createQuotation(req, res) {
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

    const result = await quotationService.createQuotation(
      leads_id,
      userId,
      builderId,
      companyId,
    );

    if (result.success) {
      return successResponse(res, result.data, 201, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function getQuotationsByLeadId(req, res) {
  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Builder ID missing",
      );
    }

    const result = await quotationService.getQuotationsByLeadId(
      leads_id,
      builderId,
      companyId,
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function getQuotationVersions(req, res) {
  try {
    const { quotation_id } = req.params;
    const { version_id } = req.query;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.getQuotationVersions(
      quotation_id,
      builderId,
      companyId,
      version_id
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function getQuotationVersionById(req, res) {
  try {
    const { quotation_version_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.getQuotationVersionById(
      quotation_version_id,
      builderId,
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function updateQuotationVersion(req, res) {
  try {
    const { quotation_version_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.updateQuotationVersion(
      quotation_version_id,
      req.body,
      builderId,
      companyId,
      req.user?.users_id
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function deleteQuotation(req, res) {
  try {
    const { quotation_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.deleteQuotation(
      quotation_id,
      builderId,
      companyId,
      req.user?.users_id
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function duplicateQuotationVersion(req, res) {
  try {
    const { quotation_version_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.duplicateQuotationVersion(
      quotation_version_id,
      builderId,
      companyId,
      req.user?.users_id
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function compareQuotationVersions(req, res) {
  try {
    const { leads_id } = req.params;
    const { versions, show_all } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const showAll = show_all !== false;

    const result = await quotationService.compareQuotationVersions(
      leads_id,
      versions,
      showAll,
      builderId,
      companyId,
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);

  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export const removePackageFromVersion = async (req, res) => {
  try {
    const { quotation_version_id, package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.removePackageFromVersion(
      quotation_version_id,
      package_id,
      builderId,
      companyId,
      req.user?.users_id
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
};

export async function previewPDF(req, res) {
  try {
    const { quotation_version_id } = req.params;
    const { download } = req.query;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.getQuotationPDF(
      quotation_version_id,
      builderId,
      companyId
    );

    if (result.success) {
      const { pdfUrl } = result.data;
      return successResponse(res, { pdfUrl }, "PDF URL fetched successfully");
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function sendQuotationEmail(req, res) {
  try {
    const { quotation_version_id } = req.params;
    const userId = req.user?.user_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.sendQuotationEmail(
      quotation_version_id,
      userId,
      builderId,
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    if (!error.status || error.status >= 500) {
      console.error("Quotation operation error:", error);
    }
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function viewQuotationByHash(req, res) {
  try {
    const { hash } = req.params;
    const result = await quotationService.getQuotationByHash(hash);

    if (result.success) {
      return successResponse(res, result.data, "Quotation fetched successfully");
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    console.error("View quotation by hash error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export default {
  getAllQuotations,
  getQuotationFilterOptions,
  getQuotationStatusCounts,
  createQuotation,
  getQuotationsByLeadId,
  getQuotationVersions,
  getQuotationVersionById,
  updateQuotationVersion,
  deleteQuotation,
  duplicateQuotationVersion,
  compareQuotationVersions,
  removePackageFromVersion,
  previewPDF,
  sendQuotationEmail,
  viewQuotationByHash
};
