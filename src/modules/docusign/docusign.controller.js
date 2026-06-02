import crypto from "crypto";
import docusignService from "../../service/docusign.service.js";
import docusignConfig from "../../config/docusign.config.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import db from "../../config/database/models/postgre-models/index.js";
import { decodeSignToken } from "../../utils/hashEncoder.js";
import { env } from "../../config/env.config.js";
import { Op } from "sequelize";
import { getQuotationDriveFileS3Key } from "../../helper/quotationDriveFile.helper.js";
import { DRIVE_FILE_MAPPING } from "../../constants/driveFile.js";

class DocuSignController {
  /**
   * Send quotation for e-signature
   */
  async sendQuotationForEsign(req, res) {
    try {
      const { quotation_version_id } = req.params;
      const payloadOptions = req.body;
      const { user_id, builder_id, company_id } = req.user;

      const { QuotationVersion, Quotation, Leads } = db.sequelize.models;
      const quotation = await QuotationVersion.findOne({
        where: { quotation_version_id },
        include: [
          {
            model: Quotation,
            as: "quotation",
            include: [{ 
              model: Leads, 
              as: "lead",
              where: {
                [Op.or]: [
                  { builder_id },
                  ...(company_id ? [{ company_id }] : [])
                ]
              }
            }]
          }
        ]
      });

      if (!quotation) return errorResponse(res, 404, "Quotation not found or unauthorized");
      if (quotation.esign_envelope_id) return errorResponse(res, 400, "Quotation already sent for e-signature");

      const result = await docusignService.createQuotationEnvelope(
        quotation_version_id,
        payloadOptions,
        user_id,
        quotation.quotation.lead.leads_id
      );

      await QuotationVersion.update(
        { esign_status: "sent", esign_envelope_id: result.envelopeId },
        { where: { quotation_version_id } }
      );

      return successResponse(res, { envelopeId: result.envelopeId, status: result.status });
    } catch (error) {
      console.error("Error sending quotation for e-signature:", error);
      return errorResponse(res, 500, error.message);
    }
  }

  async cancelEsignRequest(req, res) {
    try {
      const { envelope_id } = req.params;
      const { void_reason } = req.body;
      const { builder_id, company_id } = req.user;

      const { DocuSignEnvelope, QuotationVersion, Quotation, Leads } = db.sequelize.models;
      const envelope = await DocuSignEnvelope.findOne({
        where: { envelope_id },
        include: [
          {
            model: QuotationVersion,
            as: "quotationVersion",
            include: [{
              model: Quotation,
              as: "quotation",
              include: [{
                model: Leads,
                as: "lead",
                where: {
                  [Op.or]: [
                    { builder_id },
                    ...(company_id ? [{ company_id }] : [])
                  ]
                }
              }]
            }]
          }
        ]
      });

      if (!envelope) return errorResponse(res, 404, "Envelope not found or unauthorized");

      await docusignService.cancelEnvelope(envelope_id, void_reason);
      return successResponse(res, { message: "E-signature request canceled successfully" });

    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(req, res) {
    try {
      const { envelopeId } = req.params;
      const result = await docusignService.getEnvelopeStatus(envelopeId);
      return successResponse(res, {
        envelopeId: result.envelopeId,
        status: result.status
      });
    } catch (error) {
      console.error("Error getting envelope status:", error);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Get signing URL for embedded signing
   */
  async getSigningUrl(req, res) {
    try {
      const { envelope_id } = req.params;
      const { return_url, signer_email, signer_name } = req.query;
      const { builder_id, company_id } = req.user;

      const { DocuSignEnvelope, QuotationVersion, Quotation, Leads } = db.sequelize.models;
      const envelope = await DocuSignEnvelope.findOne({
        where: { envelope_id },
        include: [
          {
            model: QuotationVersion,
            as: "quotationVersion",
            include: [{
              model: Quotation,
              as: "quotation",
              include: [{
                model: Leads,
                as: "lead",
                where: {
                  [Op.or]: [
                    { builder_id },
                    ...(company_id ? [{ company_id }] : [])
                  ]
                }
              }]
            }]
          }
        ]
      });

      if (!envelope) return errorResponse(res, 404, "Envelope not found or unauthorized");

      const finalReturnUrl = return_url || docusignConfig.signingRedirectUrl || "https://localhost:3000";

      const result = await docusignService.getRecipientViewUrl(
        envelope_id,
        finalReturnUrl,
        signer_email,
        signer_name
      );

      return successResponse(res, { signingUrl: result.url });
    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Download signed document
   */
  async downloadSignedDocument(req, res) {
    try {
      const { envelope_id } = req.params;
      const { builder_id, company_id } = req.user;

      const { DocuSignEnvelope, QuotationVersion, Quotation, Leads } = db.sequelize.models;
      const envelope = await DocuSignEnvelope.findOne({
        where: { envelope_id },
        include: [
          {
            model: QuotationVersion,
            as: "quotationVersion",
            include: [{
              model: Quotation,
              as: "quotation",
              include: [{
                model: Leads,
                as: "lead",
                where: {
                  [Op.or]: [
                    { builder_id },
                    ...(company_id ? [{ company_id }] : [])
                  ]
                }
              }]
            }]
          }
        ]
      });

      if (!envelope) return errorResponse(res, 404, "Envelope not found or unauthorized");

      const result = await docusignService.downloadSignedDocument(envelope_id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="signed-document-${envelope_id}.pdf"`);
      return res.send(result.document);
    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }


  /**
   * Get e-signature status for quotation versions
   */
  async getQuotationEsignStatus(req, res) {
    try {
      const { quotationVersionId } = req.params;
      const { builderId, companyId } = req.user;

      const { QuotationVersion, Quotation, Leads, DocuSignEnvelope } = db.sequelize.models;
      const quotation = await QuotationVersion.findOne({
        where: { quotation_version_id: quotationVersionId },
        include: [
          {
            model: Quotation,
            as: "quotation",
            include: [{ 
              model: Leads, 
              as: "lead",
              where: {
                [Op.or]: [
                  { builder_id: builderId },
                  ...(companyId ? [{ company_id: companyId }] : [])
                ]
              }
            }]
          },
          {
            model: DocuSignEnvelope,
            as: "esignEnvelope"
          }
        ]
      });

      if (!quotation) {
        return errorResponse(res, 404, "Quotation version not found or unauthorized");
      }

      const qData = quotation.get({ plain: true });

      const [pdfS3Key, signedPdfS3Key] = await Promise.all([
        getQuotationDriveFileS3Key(quotationVersionId, DRIVE_FILE_MAPPING.SUB_REFERENCES.QUOTATION_REPORT),
        getQuotationDriveFileS3Key(quotationVersionId, DRIVE_FILE_MAPPING.SUB_REFERENCES.SIGNED_QUOTATION_REPORT),
      ]);

      const s3Prefix = `https://${env.AWS.S3_BUCKET_NAME}.s3.${env.AWS.AWS_REGION}.amazonaws.com/`;
      const pdfUrl = pdfS3Key ? `${s3Prefix}${pdfS3Key}` : null;
      const signedPdfUrl = signedPdfS3Key ? `${s3Prefix}${signedPdfS3Key}` : null;

      const statusData = {
        quotationVersionId,
        referenceNumber: qData.quotation.reference_number,
        esignStatus: qData.esign_status,
        envelopeId: qData.esignEnvelope?.envelope_id,
        envelopeStatus: qData.esignEnvelope?.status,
        signerEmail: qData.esignEnvelope?.signer_email,
        signerName: qData.esignEnvelope?.signer_name,
        pdfUrl,
        signedPdfUrl,
      };

      return successResponse(res, keysToCamelCase(statusData));

    } catch (error) {
      console.error("Error getting e-signature status:", error);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Public — no auth. Called from the email Sign button.
   */
  async publicSigningRedirect(req, res) {
    const frontendBaseUrl = env.EMAIL.FRONTEND_BASE_URL || "http://localhost:3000";
    try {
      const { token } = req.query;
      if (!token) {
        return res.redirect(`${frontendBaseUrl}/signing-error?reason=missing_token`);
      }

      let decoded;
      try {
        decoded = decodeSignToken(token);
      } catch {
        return res.redirect(`${frontendBaseUrl}/signing-error?reason=invalid_token`);
      }

      const { envelopeId, signerEmail, signerName } = decoded;
      console.log(`[DocuSign] publicSigningRedirect — envelopeId: ${envelopeId}, signer: ${signerEmail}`);

      const isDev = (process.env.NODE_ENV || "development") === "development";
      const backendBaseUrl = isDev ? `http://localhost:${env.PORT || 5001}` : env.BACKEND_URL;
      const returnUrl = `${backendBaseUrl}/docusign/public/signing-callback?envelopeId=${envelopeId}`;
      const result = await docusignService.getRecipientViewUrl(envelopeId, returnUrl, signerEmail, signerName);

      console.log(`[DocuSign] Redirecting signer to DocuSign URL`);
      return res.redirect(result.url);
    } catch (error) {
      console.error("[DocuSign] publicSigningRedirect error:", error.message);
      return res.redirect(`${frontendBaseUrl}/signing-error?reason=docusign_error`);
    }
  }

  /**
   * Public — no auth. Fallback status sync.
   */
  async publicStatusSync(req, res) {
    try {
      const { envelope_id } = req.params;
      if (!envelope_id) return errorResponse(res, 400, "Missing envelope_id");

      const envelopeStatus = await docusignService.getEnvelopeStatus(envelope_id);
      await docusignService.processWebhook({
        envelopeId: envelope_id,
        status: envelopeStatus.status,
      });

      return successResponse(res, { envelopeId: envelope_id, status: envelopeStatus.status });
    } catch (error) {
      console.error("[DocuSign] publicStatusSync error:", error.message);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Handle DocuSign Connect webhooks
   */
  async handleWebhook(req, res) {
    try {
      const secret = docusignConfig.webhookSecret;
      if (secret) {
        const signature = req.headers["x-docusign-signature-1"];
        if (!signature) return errorResponse(res, 401, "Missing webhook signature");

        const rawBytes = req.rawBody ?? Buffer.from(JSON.stringify(req.body), "utf8");
        const expected = crypto.createHmac("sha256", Buffer.from(secret, "base64")).update(rawBytes).digest("base64");
        if (signature !== expected) return errorResponse(res, 401, "Invalid webhook signature");
      }

      await docusignService.processWebhook(req.body);
      return successResponse(res, { message: "Webhook processed" });
    } catch (error) {
      console.error("[DocuSign Webhook] Error:", error.message);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Get current e-signature request status
   */
  async resendEsignRequest(req, res) {
    try {
      const { quotationVersionId } = req.params;
      const { builderId, companyId } = req.user;

      const { QuotationVersion, Quotation, Leads, DocuSignEnvelope } = db.sequelize.models;
      const quotation = await QuotationVersion.findOne({
        where: { quotation_version_id: quotationVersionId },
        include: [
          {
            model: Quotation,
            as: "quotation",
            include: [{ 
              model: Leads, 
              as: "lead",
              where: {
                [Op.or]: [
                  { builder_id: builderId },
                  ...(companyId ? [{ company_id: companyId }] : [])
                ]
              }
            }]
          },
          {
            model: DocuSignEnvelope,
            as: "esignEnvelope"
          }
        ]
      });

      if (!quotation) return errorResponse(res, 404, "Quotation version not found or unauthorized");
      if (!quotation.esign_envelope_id) return errorResponse(res, 400, "No e-signature envelope found for this quotation");

      const envelopeStatus = await docusignService.getEnvelopeStatus(quotation.esign_envelope_id);
      return successResponse(res, {
        envelopeId: quotation.esign_envelope_id,
        status: envelopeStatus.status,
        message: "E-signature request status retrieved"
      });

    } catch (error) {
      console.error("Error resending e-signature request:", error);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Public — no auth. DocuSign redirects here after signing.
   */
  async signingCallback(req, res) {
    const frontendBaseUrl = env.EMAIL.FRONTEND_BASE_URL || "http://localhost:3000";
    try {
      const { envelopeId, event } = req.query;
      if (!envelopeId) return res.redirect(`${frontendBaseUrl}/signing-error?reason=missing_envelope`);

      const { DocuSignEnvelope } = db.sequelize.models;
      const envelope = await DocuSignEnvelope.findByPk(envelopeId);

      if (event === "signing_complete") {
        await docusignService.processWebhook({ envelopeId, status: "completed" });
      }

      if (envelope?.leads_id) return res.redirect(`${frontendBaseUrl}/leads/${envelope.leads_id}`);
      return res.redirect(`${frontendBaseUrl}`);
    } catch (error) {
      console.error("[DocuSign] signingCallback error:", error.message);
      return res.redirect(`${frontendBaseUrl}/signing-error?reason=callback_error`);
    }
  }
}

export default new DocuSignController();
