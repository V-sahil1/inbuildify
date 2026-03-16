import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";
import templatePdfService from "./template-pdf.service";
import { getFormatValidationSchema } from "./template-pdf.validation";

export async function createTemplatePdf(req, res) {
  try {
    const user = req.user;

    const template = await templatePdfService.createTemplatePdf(user, req.body);

    return successResponse(
      res,
      keysToCamelCase(template),
      "PDF template created successfully",
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
}

export async function updateTemplatePdf(req, res) {
  try {
    const user = req.user;
    const { template_pdf_id } = req.params;

    const formatTypeInput = req.body.format_type;
    if (!formatTypeInput) {
      return errorResponse(res, 400, "format_type is required");
    }

    const formatType = templatePdfService.normalizeFormatType(formatTypeInput);
    if (!formatType) {
      return errorResponse(res, 400, "Invalid format_type");
    }

    const schema = getFormatValidationSchema(formatType);
    if (!schema) {
      return errorResponse(res, 400, "Invalid format_type");
    }

    const payloadForValidation = { ...req.body };
    delete payloadForValidation.format_type;
    delete payloadForValidation.logo_image;
    delete payloadForValidation.watermark_image;

    const { error } = schema.validate(payloadForValidation, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        422,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const updated = await templatePdfService.updateTemplatePdf(
      user,
      template_pdf_id,
      formatType,
      req.body,
    );

    return successResponse(
      res,
      keysToCamelCase(updated),
      "Template format updated successfully",
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
}

export async function getTemplatePdfById(req, res) {
  try {
    const user = req.user;
    const { templatePdfId } = req.params;

    const template = await templatePdfService.getTemplatePdfById(
      user,
      templatePdfId,
    );

    if (!template) {
      return errorResponse(res, 404, "Template not found");
    }

    return successResponse(
      res,
      keysToCamelCase(template),
      "PDF template fetched successfully",
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Failed to fetch template");
  }
}

export async function getTemplatePdfList(req, res) {
  try {
    const user = req.user;

    const templates = await templatePdfService.getTemplatePdfList(user);

    return successResponse(
      res,
      keysToCamelCase(templates),
      "PDF templates fetched successfully",
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Failed to fetch templates");
  }
}

export async function deleteTemplatePdf(req, res) {
  try {
    const user = req.user;
    const { templatePdfId } = req.params;

    await templatePdfService.deleteTemplatePdf(user, templatePdfId);

    return successResponse(res, null, "PDF template deleted successfully");
  } catch (err) {
    console.error(err);
    return errorResponse(res, 400, err.message);
  }
}
