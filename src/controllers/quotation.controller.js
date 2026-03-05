const quotationService = require("../services/quotation.service");
const { successResponse, errorResponse } = require("../helper/response");

exports.createQuotation = async (req, res) => {
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
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, 201, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Create quotation error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getQuotationsByLeadId = async (req, res) => {
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
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Get quotations by lead error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getQuotationVersions = async (req, res) => {
  try {
    const { quotation_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const result = await quotationService.getQuotationVersions(
      quotation_id,
      builderId,
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Get quotation versions error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.updateQuotationVersion = async (req, res) => {
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
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Update quotation version error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.deleteQuotation = async (req, res) => {
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
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Delete quotation error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.duplicateQuotationVersion = async (req, res) => {
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
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Duplicate quotation version error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.compareQuotationVersions = async (req, res) => {
  try {
    const { quotation_id } = req.params;
    const { version_1, version_2, show_all } = req.query;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const showAll = show_all !== "false";

    const result = await quotationService.compareQuotationVersions(
      quotation_id,
      version_1,
      version_2,
      showAll,
      builderId,
      companyId
    );

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Compare quotation versions error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};
