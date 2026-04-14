import docusign from "docusign-esign";
import fs from "fs";
import path from "path";
import docusignConfig from "../config/docusign.config.js";
import { generatePresignedDownloadUrl, uploadFile } from "./s3.service.js";
import { logActivity } from "../utils/activityLogger.js";
import getPool from "../config/database.js";

class DocuSignService {
  constructor() {
    this.apiClient = new docusign.ApiClient();
    this.apiClient.setBasePath(docusignConfig.basePath);
  }

  async getJwtToken() {
    try {
      let privateKey;
      try {
        privateKey = fs.readFileSync(
          path.join(process.cwd(), "private.key"),
          "utf8",
        );
      } catch (fileError) {
        privateKey = docusignConfig.rsaKey.replace(/\\n/g, "\n");
      }

      const results = await this.apiClient.requestJWTUserToken(
        docusignConfig.clientId,
        docusignConfig.userId,
        ["signature", "impersonation"],
        privateKey,
        3600,
      );
      return results.body.access_token;
    } catch (error) {
      throw new Error(`DocuSign Auth Failed: ${error.message}`);
    }
  }

  async getUserInfo(accessToken) {
    this.apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);
    return await this.apiClient.getUserInfo(accessToken);
  }

  async createQuotationEnvelope(quotationVersionId, options, userId, leadsId) {
    const client = await getPool().connect();
    try {
      const quotationQuery = `
        SELECT qv.*, q.reference_number, l.email, l.name
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        JOIN leads l ON q.leads_id = l.leads_id
        WHERE qv.quotation_version_id = $1
      `;
      const quotationResult = await client.query(quotationQuery, [
        quotationVersionId,
      ]);

      if (quotationResult.rowCount === 0)
        throw new Error("Quotation version not found");
      const quotation = quotationResult.rows[0];
      if (!quotation.pdf_url)
        throw new Error("Quotation PDF not generated yet.");

      const accessToken = await this.getJwtToken();
      const userInfo = await this.getUserInfo(accessToken);
      const accountId = userInfo.accounts[0].accountId;
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      let documentUrl;
      try {
        const documentUrlResult = await generatePresignedDownloadUrl(
          quotation.pdf_url,
        );
        // UPDATED: Used the actual presigned URL so DocuSign can fetch private S3 files
        documentUrl = documentUrlResult.url; 
      } catch (pdfError) {
        throw new Error(`Failed to generate PDF URL: ${pdfError.message}`);
      }

      const envDef = new docusign.EnvelopeDefinition();
      envDef.emailSubject =
        options.emailSubject || docusignConfig.defaultEmailSubject.quotation;
      envDef.emailBlurb =
        options.emailBlurb || docusignConfig.defaultEmailMessage.quotation;
      envDef.status = "sent";

      const doc = new docusign.Document();
      doc.documentBase64 = await this.getDocumentAsBase64(documentUrl);
      doc.name = `Quotation - ${quotation.reference_number}`;
      doc.fileExtension = "pdf";
      doc.documentId = "1";
      envDef.documents = [doc];

      envDef.recipients = new docusign.Recipients();
      let recipientIdCounter = 1;

      // 1. Map Signers
      const docSigners = options.signers.map((s, index) => {
        const signer = new docusign.Signer();
        signer.email = s.email;
        signer.name = s.name;
        signer.recipientId = recipientIdCounter.toString();
        signer.routingOrder = s.routingOrder || "1";

        if (options.useEmbeddedSigning) {
          signer.clientUserId = s.clientUserId || s.email;
        }

        const signHere = new docusign.SignHere();
        signHere.documentId = "1";
        signHere.pageNumber = "1";
        signHere.recipientId = recipientIdCounter.toString();
        signHere.tabLabel = `Signature_${recipientIdCounter}`;
        signHere.xPosition = (100 + index * 150).toString(); // Spaced horizontally
        signHere.yPosition = "100";

        signer.tabs = new docusign.Tabs();
        signer.tabs.signHereTabs = [signHere];

        recipientIdCounter++;
        return signer;
      });
      envDef.recipients.signers = docSigners;

      // 2. Map Carbon Copies
      if (options.ccRecipients && options.ccRecipients.length > 0) {
        const carbonCopies = options.ccRecipients.map((cc) => {
          const carbonCopy = new docusign.CarbonCopy();
          carbonCopy.email = cc.email;
          carbonCopy.name = cc.name;
          carbonCopy.recipientId = recipientIdCounter.toString();
          carbonCopy.routingOrder = cc.routingOrder || "2";

          recipientIdCounter++;
          return carbonCopy;
        });
        envDef.recipients.carbonCopies = carbonCopies;
      }

      const envelope = await envelopesApi.createEnvelope(accountId, {
        envelopeDefinition: envDef,
      });

      const primarySigner = options.signers[0];
      await this.saveEnvelopeInfo(
        client,
        envelope.envelopeId,
        quotationVersionId,
        "quotation",
        primarySigner.email,
        primarySigner.name,
        userId,
        leadsId,
      );

      await logActivity(client, {
        userId,
        leadsId,
        module: "DocuSign",
        moduleId: envelope.envelopeId,
        recordName: quotation.reference_number,
        action: "CREATE",
        description: `DocuSign envelope sent for: ${quotation.reference_number}`,
      });

      return {
        success: true,
        envelopeId: envelope.envelopeId,
        status: envelope.status,
      };
    } finally {
      client.release();
    }
  }

  async cancelEnvelope(envelopeId, voidReason) {
    const client = await getPool().connect();
    try {
      const accessToken = await this.getJwtToken();
      const userInfo = await this.getUserInfo(accessToken);
      const accountId = userInfo.accounts[0].accountId;
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      const envelope = new docusign.Envelope();
      envelope.status = "voided";
      envelope.voidedReason = voidReason || "Canceled by sender.";

      await envelopesApi.update(accountId, envelopeId, { envelope });
      await this.updateEnvelopeStatus(envelopeId, "voided");

      return { success: true };
    } finally {
      client.release();
    }
  }

  async getEnvelopeStatus(envelopeId) {
    const accessToken = await this.getJwtToken();
    const userInfo = await this.getUserInfo(accessToken);
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
    const envelope = await envelopesApi.getEnvelope(
      userInfo.accounts[0].accountId,
      envelopeId,
    );
    return {
      success: true,
      status: envelope.status,
      envelopeId: envelope.envelopeId,
    };
  }

  async getRecipientViewUrl(envelopeId, returnUrl, signerEmail, signerName) {
    const accessToken = await this.getJwtToken();
    const userInfo = await this.getUserInfo(accessToken);
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

    const recipientViewRequest = new docusign.RecipientViewRequest();
    recipientViewRequest.returnUrl = returnUrl;
    recipientViewRequest.authenticationMethod = "email";
    recipientViewRequest.email = signerEmail;
    recipientViewRequest.userName = signerName;
    recipientViewRequest.recipientId = "1"; // Assuming primary signer
    recipientViewRequest.clientUserId = signerEmail; // Required for embedded signing

    const viewUrl = await envelopesApi.createRecipientView(
      userInfo.accounts[0].accountId,
      envelopeId,
      { recipientViewRequest },
    );
    return { success: true, url: viewUrl.url };
  }

  async downloadSignedDocument(envelopeId) {
    const accessToken = await this.getJwtToken();
    const userInfo = await this.getUserInfo(accessToken);
    const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

    const combinedDocument = await envelopesApi.getDocument(
      userInfo.accounts[0].accountId,
      envelopeId,
      "combined",
    );
    return { success: true, document: combinedDocument };
  }

  async saveEnvelopeInfo(
    client,
    envelopeId,
    referenceId,
    type,
    signerEmail,
    signerName,
    userId,
    leadsId,
  ) {
    const query = `
      INSERT INTO docusign_envelopes (
        envelope_id, reference_id, type, signer_email, signer_name,
        status, created_by, leads_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (envelope_id) 
      DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
    `;
    await client.query(query, [
      envelopeId,
      referenceId,
      type,
      signerEmail,
      signerName,
      "sent",
      userId,
      leadsId,
    ]);
  }

  async updateEnvelopeStatus(envelopeId, status) {
    const client = await getPool().connect();
    try {
      await client.query(
        `UPDATE docusign_envelopes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE envelope_id = $2`,
        [status, envelopeId],
      );
    } finally {
      client.release();
    }
  }

  async getDocumentAsBase64(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }

  async processWebhook(webhookData) {
    const client = await getPool().connect();
    try {
      const eventType = webhookData.event;
      const envelopeId = webhookData.data?.envelopeId;

      if (!envelopeId || !eventType) {
        console.warn("Received invalid webhook payload format from DocuSign.");
        return { success: false, message: "Invalid payload" };
      }

      // Map DocuSign webhook events to our internal statuses
      let status = "sent";
      if (eventType === "envelope-completed")
        status = "completed"; // Signed
      else if (eventType === "envelope-voided")
        status = "voided"; // Cancelled or Expired
      else if (eventType === "envelope-declined")
        status = "declined"; // Rejected by user
      else if (eventType === "envelope-sent" || eventType === "envelope-resent")
        status = "sent"; // Resent

      console.log(
        `Processing Webhook: Envelope ${envelopeId} status changed to ${status}`,
      );

      // 1. Update the tracking table status
      await this.updateEnvelopeStatus(envelopeId, status);

      // 2. Get envelope details to update the main quotation_version table
      const envelopeQuery = `
        SELECT de.*, qv.quotation_version_id
        FROM docusign_envelopes de
        LEFT JOIN quotation_version qv ON de.reference_id = qv.quotation_version_id AND de.type = 'quotation'
        WHERE de.envelope_id = $1
      `;
      const envelopeResult = await client.query(envelopeQuery, [envelopeId]);

      if (envelopeResult.rowCount > 0) {
        const envelope = envelopeResult.rows[0];

        // 3. Log webhook activity
        await logActivity(client, {
          userId: null, // System action
          leadsId: envelope.leads_id,
          module: "DocuSign",
          moduleId: envelopeId,
          recordName: envelope.type,
          action: "WEBHOOK",
          description: `DocuSign webhook received: ${status} for ${envelope.type}`,
        });

        // 4. Handle 'Completed' (Signed) - Upload to S3
        if (status === "completed" && envelope.quotation_version_id) {
          console.log(
            `Downloading signed document for envelope ${envelopeId}...`,
          );

          // Get the signed document from DocuSign
          const signedDocResult = await this.downloadSignedDocument(envelopeId);

          // DocuSign Node SDK returns the document as a binary string, convert to Node Buffer
          const fileBuffer = Buffer.from(signedDocResult.document, "binary");

          // Generate a logical S3 Key
          const timestamp = new Date().getTime();
          const s3Key = `signed_documents/leads_${envelope.leads_id}/quote_${envelope.quotation_version_id}_${timestamp}.pdf`;

          // Upload to S3
          const uploadResult = await uploadFile(
            s3Key,
            fileBuffer,
            "application/pdf",
          );

          if (uploadResult.success) {
            console.log(
              `Successfully uploaded signed document to S3: ${uploadResult.location}`,
            );

            // Update the quotation_version table with the S3 key/url
            await client.query(
              `
              UPDATE quotation_version 
              SET esign_status = $1, signed_pdf_url = $2
              WHERE quotation_version_id = $3
            `,
              [status, uploadResult.key, envelope.quotation_version_id],
            );
          } else {
            console.error(
              "Failed to upload signed document to S3:",
              uploadResult.error,
            );
            // Even if S3 fails, update the status to completed so we don't block the UI
            await client.query(
              `UPDATE quotation_version SET esign_status = $1 WHERE quotation_version_id = $2`,
              [status, envelope.quotation_version_id],
            );
          }
        }
        // 5. Handle Cancelled, Expired, or Resent
        else if (envelope.quotation_version_id) {
          // Just update the status on the quotation version
          await client.query(
            `
            UPDATE quotation_version 
            SET esign_status = $1 
            WHERE quotation_version_id = $2
          `,
            [status, envelope.quotation_version_id],
          );
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error processing DocuSign webhook:", error);
      throw new Error(`Failed to process webhook: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

export default new DocuSignService();
