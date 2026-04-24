import docusign from "docusign-esign";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import docusignConfig from "../config/docusign.config.js";
import { generatePresignedDownloadUrl, uploadFile } from "./s3.service.js";
import { logActivity } from "../utils/activityLogger.js";
import getPool from "../config/database.js";
import quotationEmailQueue from "../workers/quoteApprovedEmailWorker.js";

/**
 * Extracts and logs every available detail from a DocuSign / Axios error.
 * Call this in every catch block so the terminal always shows the full picture.
 */
function logDocuSignError(label, error) {
  const status = error.response?.status ?? error.statusCode ?? error.status ?? "N/A";
  const body = error.response?.data ?? error.response?.body ?? error.body ?? null;
  const headers = error.response?.headers ?? null;

  console.error("\n╔══════════════════════════════════════════════════");
  console.error(`║ [DocuSign ERROR] ${label}`);
  console.error("╠══════════════════════════════════════════════════");
  console.error("║ HTTP Status :", status);
  console.error("║ Message     :", error.message);
  if (body) console.error("║ Body        :", JSON.stringify(body, null, 2));
  if (headers) console.error("║ Headers     :", JSON.stringify(headers));
  console.error("║ Stack       :", error.stack?.split("\n").slice(0, 4).join("\n║              "));
  console.error("╚══════════════════════════════════════════════════\n");

  // Surface the actionable hint for the most common cause
  const errCode = body?.error ?? body?.errorCode ?? "";
  if (errCode === "consent_required" || String(body).includes("consent_required")) {
    console.error(
      `[DocuSign] ⚠️  CONSENT REQUIRED — open this URL in a browser once:\n` +
      `  https://account-d.docusign.com/oauth/auth` +
      `?response_type=code&scope=signature%20impersonation` +
      `&client_id=${docusignConfig.clientId}` +
      `&redirect_uri=${encodeURIComponent(docusignConfig.signingRedirectUrl)}\n`
    );
  }
}

class DocuSignService {
  constructor() {
    this.apiClient = new docusign.ApiClient();
    this.apiClient.setBasePath(docusignConfig.basePath);
  }

  async getJwtToken() {
    let rawPem;
    try {
      rawPem = fs.readFileSync(path.join(process.cwd(), "private.key"), "utf8");
    } catch {
      rawPem = docusignConfig.rsaKey;
    }

    const normalizedPem = rawPem.replace(/\\n/g, "\n").replace(/\\r/g, "").trim();
    const privateKey = crypto.createPrivateKey(normalizedPem);

    let results;
    try {
      results = await this.apiClient.requestJWTUserToken(
        docusignConfig.clientId,
        docusignConfig.userId,
        ["signature", "impersonation"],
        privateKey,
        3600,
      );
    } catch (error) {
      logDocuSignError("requestJWTUserToken", error);
      throw new Error(`DocuSign JWT request failed: ${error.message}`);
    }

    // SDK may silently return error body instead of throwing on non-2xx
    const token = results?.body?.access_token;
    if (!token) {
      const body = results?.body ?? results ?? {};
      logDocuSignError("requestJWTUserToken (no access_token)", { message: "No access_token in response", body, response: { data: body } });
      throw new Error(`DocuSign returned no access_token: ${JSON.stringify(body)}`);
    }

    return token;
  }

  async getUserInfo(accessToken) {
    this.apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);
    try {
      return await this.apiClient.getUserInfo(accessToken);
    } catch (error) {
      logDocuSignError("getUserInfo", error);
      throw new Error(`DocuSign getUserInfo failed: ${error.message}`);
    }
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

      let documentBase64;
      if (options.pdfBuffer) {
        documentBase64 = options.pdfBuffer.toString("base64");
      } else {
        // Fallback: extract S3 key from full URL if needed
        let s3Key = quotation.pdf_url;
        const s3UrlMatch = quotation.pdf_url?.match(/amazonaws\.com\/(.+)$/);
        if (s3UrlMatch) s3Key = s3UrlMatch[1];

        try {
          const documentUrlResult = await generatePresignedDownloadUrl(s3Key);
          documentBase64 = await this.getDocumentAsBase64(documentUrlResult.url);
        } catch (pdfError) {
          throw new Error(`Failed to fetch PDF from S3: ${pdfError.message}`);
        }
      }

      const envDef = new docusign.EnvelopeDefinition();
      envDef.emailSubject =
        options.emailSubject || docusignConfig.defaultEmailSubject.quotation;
      envDef.emailBlurb =
        options.emailBlurb || docusignConfig.defaultEmailMessage.quotation;
      envDef.status = "sent";

      const doc = new docusign.Document();
      doc.documentBase64 = documentBase64;
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

      // 3. Attach EventNotification so DocuSign POSTs status changes to our webhook
      const webhookUrl = docusignConfig.webhookUrl;
      if (webhookUrl) {
        const eventNotification = new docusign.EventNotification();
        eventNotification.url = webhookUrl;
        eventNotification.loggingEnabled = "true";
        eventNotification.requireAcknowledgment = "true";
        eventNotification.useSoapInterface = "false";
        eventNotification.includeDocuments = "false";
        eventNotification.includeEnvelopeVoidReason = "true";
        eventNotification.includeTimeZone = "false";
        eventNotification.includeSenderAccountAsCustomField = "false";
        eventNotification.includeDocumentFields = "false";
        eventNotification.includeCertificateOfCompletion = "false";
        eventNotification.envelopeEvents = [
          { envelopeEventStatusCode: "sent" },
          { envelopeEventStatusCode: "completed" },
          { envelopeEventStatusCode: "declined" },
          { envelopeEventStatusCode: "voided" },
        ];
        envDef.eventNotification = eventNotification;
        console.log(`[DocuSign] EventNotification configured → ${webhookUrl}`);
      } else {
        console.warn("[DocuSign] DOCUSIGN_WEBHOOK_URL not set — webhook events will not fire");
      }

      let envelope;
      try {
        envelope = await envelopesApi.createEnvelope(accountId, {
          envelopeDefinition: envDef,
        });
      } catch (error) {
        logDocuSignError("createEnvelope", error);
        throw new Error(`DocuSign createEnvelope failed: ${error.message}`);
      }

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
    recipientViewRequest.recipientId = "1";
    recipientViewRequest.clientUserId = signerEmail; // must match clientUserId set at envelope creation

    try {
      const viewUrl = await envelopesApi.createRecipientView(
        userInfo.accounts[0].accountId,
        envelopeId,
        { recipientViewRequest },
      );
      return { success: true, url: viewUrl.url };
    } catch (error) {
      logDocuSignError("createRecipientView", error);
      throw new Error(`DocuSign createRecipientView failed: ${error.message}`);
    }
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
      // Normalize both DocuSign Connect JSON and per-envelope EventNotification JSON formats
      // Connect:             { event: "envelope-completed", data: { envelopeId: "..." } }
      // EventNotification:  { status: "completed", envelopeId: "..." }
      let envelopeId, rawStatus;
      if (webhookData.event && webhookData.data?.envelopeId) {
        // DocuSign Connect format
        envelopeId = webhookData.data.envelopeId;
        rawStatus = webhookData.event.replace("envelope-", ""); // "completed", "voided", etc.
      } else if (webhookData.envelopeId && webhookData.status) {
        // EventNotification format (per-envelope)
        envelopeId = webhookData.envelopeId;
        rawStatus = webhookData.status.toLowerCase();
      } else {
        console.warn("[DocuSign Webhook] Unrecognised payload format:", JSON.stringify(webhookData).slice(0, 200));
        return { success: false, message: "Invalid payload" };
      }

      // Map raw status to our ENUM values
      let status = "sent";
      if (rawStatus === "completed") status = "completed";
      else if (rawStatus === "voided") status = "voided";
      else if (rawStatus === "declined") status = "declined";
      else if (rawStatus === "sent" || rawStatus === "resent" || rawStatus === "delivered") status = "sent";

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

          // SDK may return a Buffer or a binary string depending on version
          const rawDoc = signedDocResult.document;
          const fileBuffer = Buffer.isBuffer(rawDoc)
            ? rawDoc
            : Buffer.from(rawDoc, "binary");

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

            // Update quotation_version and approve the quotation
            await client.query(
              `UPDATE quotation_version
               SET esign_status = $1, signed_pdf_url = $2, is_approve = true
               WHERE quotation_version_id = $3`,
              [status, uploadResult.key, envelope.quotation_version_id],
            );
          } else {
            console.error(
              "Failed to upload signed document to S3:",
              uploadResult.error,
            );
            await client.query(
              `UPDATE quotation_version SET esign_status = $1, is_approve = true WHERE quotation_version_id = $2`,
              [status, envelope.quotation_version_id],
            );
          }

          // Queue email to structural engineer with full quote + lead + property details
          await quotationEmailQueue.add(
            { quotationVersionId: envelope.quotation_version_id, envelopeId },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
          );
          console.log(
            `[DocuSign] Queued quote-approved email for version ${envelope.quotation_version_id}`
          );
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
