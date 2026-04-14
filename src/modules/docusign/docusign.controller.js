import docusignService from "../../service/docusign.service.js";
import docusignConfig from "../../config/docusign.config.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import getPool from "../../config/database.js";

class DocuSignController {
  /**
   * Send quotation for e-signature
   */
  async sendQuotationForEsign(req, res) {
    try {
      const { quotation_version_id } = req.params;
      const payloadOptions = req.body; 
      const { user_id, builder_id, company_id } = req.user;

      const client = getPool();
      const checkQuery = `
        SELECT qv.*, q.leads_id
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE qv.quotation_version_id = $1 
        AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [quotation_version_id, builder_id, company_id]);

      if (checkResult.rowCount === 0) return errorResponse(res, 404, "Quotation not found or unauthorized");
      if (checkResult.rows[0].esign_envelope_id) return errorResponse(res, 400, "Quotation already sent for e-signature");

      const result = await docusignService.createQuotationEnvelope(
        quotation_version_id,
        payloadOptions, 
        user_id,
        checkResult.rows[0].leads_id
      );

      await client.query(
        "UPDATE quotation_version SET esign_status = $1, esign_envelope_id = $2 WHERE quotation_version_id = $3",
        ["sent", result.envelopeId, quotation_version_id]
      );

      return successResponse(res, 200, { envelopeId: result.envelopeId, status: result.status });
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

      const client = getPool();
      const checkQuery = `
        SELECT de.* FROM docusign_envelopes de
        LEFT JOIN quotation_version qv ON de.reference_id = qv.quotation_version_id
        LEFT JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads l ON q.leads_id = l.leads_id
        WHERE de.envelope_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)
      `;
      const checkResult = await client.query(checkQuery, [envelope_id, builder_id, company_id]);

      if (checkResult.rowCount === 0) return errorResponse(res, 404, "Envelope not found or unauthorized");

      await docusignService.cancelEnvelope(envelope_id, void_reason);
      return successResponse(res, 200, { message: "E-signature request canceled successfully" });

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

      return successResponse(res, 200, {
        envelopeId: result.envelopeId,
        status: result.status
      });

    } catch (error) {
      console.error("Error getting envelope status:", error);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Get signing URL for embedded signing (UPDATED)
   */
  async getSigningUrl(req, res) {
    try {
      const { envelope_id } = req.params;
      const { return_url, signer_email, signer_name } = req.query;
      const { builder_id, company_id } = req.user;

      const client = getPool();
      const checkQuery = `
        SELECT de.* FROM docusign_envelopes de
        LEFT JOIN quotation_version qv ON de.reference_id = qv.quotation_version_id
        LEFT JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads l ON q.leads_id = l.leads_id
        WHERE de.envelope_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)
      `;
      const checkResult = await client.query(checkQuery, [envelope_id, builder_id, company_id]);

      if (checkResult.rowCount === 0) return errorResponse(res, 404, "Envelope not found or unauthorized");

      const finalReturnUrl = return_url || docusignConfig.signingRedirectUrl || "https://localhost:3000";

      const result = await docusignService.getRecipientViewUrl(
        envelope_id,
        finalReturnUrl,
        signer_email,
        signer_name
      );

      return successResponse(res, 200, { signingUrl: result.url });
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

      const client = getPool();
      const checkQuery = `
        SELECT de.* FROM docusign_envelopes de
        LEFT JOIN quotation_version qv ON de.reference_id = qv.quotation_version_id
        LEFT JOIN quotation q ON qv.quotation_id = q.quotation_id
        LEFT JOIN leads l ON q.leads_id = l.leads_id
        WHERE de.envelope_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)
      `;
      const checkResult = await client.query(checkQuery, [envelope_id, builder_id, company_id]);

      if (checkResult.rowCount === 0) return errorResponse(res, 404, "Envelope not found or unauthorized");

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
      const { userId, builderId, companyId } = req.user;

      // Verify quotation version exists and user has access
      const client = getPool();
      const checkQuery = `
        SELECT qv.*, q.reference_number, de.envelope_id, de.status as envelope_status, de.signer_email, de.signer_name
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        LEFT JOIN docusign_envelopes de ON qv.esign_envelope_id = de.envelope_id
        WHERE qv.quotation_version_id = $1 
        AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [quotationVersionId, builderId, companyId]);

      if (checkResult.rowCount === 0) {
        return errorResponse(res, 404, "Quotation version not found or unauthorized");
      }

      const quotation = checkResult.rows[0];

      const statusData = {
        quotationVersionId,
        referenceNumber: quotation.reference_number,
        esignStatus: quotation.esign_status,
        envelopeId: quotation.envelope_id,
        envelopeStatus: quotation.envelope_status,
        signerEmail: quotation.signer_email,
        signerName: quotation.signer_name,
        pdfUrl: quotation.pdf_url,
        signedPdfUrl: quotation.signed_pdf_url
      };

      return successResponse(res, 200, keysToCamelCase(statusData));

    } catch (error) {
      console.error("Error getting e-signature status:", error);
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Handle DocuSign webhooks
   */
  async handleWebhook(req, res) {
    try {
      const webhookData = req.body;
      
      // Security Check: Optional HMAC signature verification goes here using docusignConfig.webhookSecret
      
      await docusignService.processWebhook(webhookData);
      return successResponse(res, 200, { message: "Webhook processed" });
    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }

  /**
   * Resend e-signature request
   */
  async resendEsignRequest(req, res) {
    try {
      const { quotationVersionId } = req.params;
      const { userId, builderId, companyId } = req.user;

      // Verify quotation version exists and user has access
      const client = getPool();
      const checkQuery = `
        SELECT qv.*, q.leads_id, q.reference_number, de.envelope_id
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        LEFT JOIN docusign_envelopes de ON qv.esign_envelope_id = de.envelope_id
        WHERE qv.quotation_version_id = $1 
        AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
      `;
      const checkResult = await client.query(checkQuery, [quotationVersionId, builderId, companyId]);

      if (checkResult.rowCount === 0) {
        return errorResponse(res, 404, "Quotation version not found or unauthorized");
      }

      const quotation = checkResult.rows[0];

      if (!quotation.envelope_id) {
        return errorResponse(res, 400, "No e-signature envelope found for this quotation");
      }

      // Get current envelope status
      const envelopeStatus = await docusignService.getEnvelopeStatus(quotation.envelope_id);

      if (envelopeStatus.status === "completed") {
        return errorResponse(res, 400, "Document has already been signed");
      }

      // Resend the envelope
      // This would require implementing the resend functionality in the DocuSign service
      // For now, we'll return the current status

      return successResponse(res, 200, {
        envelopeId: quotation.envelope_id,
        status: envelopeStatus.status,
        message: "E-signature request status retrieved"
      });

    } catch (error) {
      console.error("Error resending e-signature request:", error);
      return errorResponse(res, 500, error.message);
    }
  }
}

export default new DocuSignController();
