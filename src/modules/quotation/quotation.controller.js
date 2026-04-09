import quotationService from "./quotation.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";

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
    console.error("Create quotation error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Get quotations by lead error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Get quotation versions error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Update quotation version error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Delete quotation error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Duplicate quotation version error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Compare quotation versions error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Remove package from quotation version error:", error);
    return errorResponse(res, 500, "Internal server error");
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
    console.error("Preview PDF error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function sendQuotationEmail(req, res) {
  try {
    const { quotation_version_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.sendQuotationEmail(
      quotation_version_id,
      builderId,
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    }
    return errorResponse(res, 400, result.message);
  } catch (error) {
    console.error("Send quotation email error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

export default {
  createQuotation,
  getQuotationsByLeadId,
  getQuotationVersions,
  updateQuotationVersion,
  deleteQuotation,
  duplicateQuotationVersion,
  compareQuotationVersions,
  removePackageFromVersion,
  previewPDF,
  sendQuotationEmail
};
