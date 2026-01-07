const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const templatePdfService = require("../services/template-pdf.service");

exports.createTemplatePdf = async (req, res) => {
  try {
    const user = req.user;

    const template = await templatePdfService.createTemplatePdf(
      user,
      req.body
    );

    return successResponse(
      res,
      keysToCamelCase(template),
      "PDF template created successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
};

exports.updateTemplatePdf = async (req, res) => {
  try {
    const user = req.user;
    const { template_pdf_id: templatePdfId } = req.params;

    console.log("🚀 ~ req.body:", req.body)
    const template = await templatePdfService.updateTemplatePdf(
      user,
      templatePdfId,
      req.body
    );

    return successResponse(
      res,
      keysToCamelCase(template),
      "PDF template updated successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
};

exports.getTemplatePdfById = async (req, res) => {
  try {
    const user = req.user;
    const { templatePdfId } = req.params;

    const template = await templatePdfService.getTemplatePdfById(
      user,
      templatePdfId
    );

    if (!template) {
      return errorResponse(res, 404, "Template not found");
    }

    return successResponse(
      res,
      keysToCamelCase(template),
      "PDF template fetched successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Failed to fetch template");
  }
};

exports.getTemplatePdfList = async (req, res) => {
  try {
    const user = req.user;

    const templates = await templatePdfService.getTemplatePdfList(user);

    return successResponse(
      res,
      keysToCamelCase(templates),
      "PDF templates fetched successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Failed to fetch templates");
  }
};

exports.deleteTemplatePdf = async (req, res) => {
  try {
    const user = req.user;
    const { templatePdfId } = req.params;

    await templatePdfService.deleteTemplatePdf(user, templatePdfId);

    return successResponse(res, null, "PDF template deleted successfully");
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
};
