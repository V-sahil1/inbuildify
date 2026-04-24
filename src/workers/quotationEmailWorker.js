import Bull from "bull";
import { env } from "../config/env.config.js";
import getPool from "../config/database.js";
import db from "../config/database/models/postgre-models/index.js";
import quotationRepository from "../modules/quotation/quotation.repository.js";
import { generatePDF } from "../modules/quotation/pdf.service.js";
import { generateQuotationHTML } from "../utils/template.js";
import { uploadFile, generatePresignedDownloadUrl } from "../service/s3.service.js";
import docusignService from "../service/docusign.service.js";
import { encodeQuotationHash, encodeSignToken } from "../utils/hashEncoder.js";
import { renderTemplate } from "../utils/templateRenderer.js";
import sendEmail from "../service/sendMail.service.js";

const redisConfig = {
  host: env.REDIS.REDIS_HOST,
  port: env.REDIS.REDIS_PORT,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

const quotationEmailQueue = new Bull("quotationEmailQueue", { redis: redisConfig });

quotationEmailQueue.process(async (job) => {
  const { versionId, userId, builderId, companyId } = job.data;
  const client = getPool();
  const { NotificationTemplate, Notifications } = db;

  // 1. Re-fetch ownership + builder context
  const checkResult = await client.query(
    `SELECT qv.quotation_version_id, qv.esign_envelope_id,
            q.quotation_id, q.reference_number,
            l.leads_id, l.email AS lead_email, l.name AS lead_name,
            l.builder_id
     FROM quotation_version qv
     JOIN quotation q ON qv.quotation_id = q.quotation_id
     JOIN leads l ON q.leads_id = l.leads_id
     WHERE qv.quotation_version_id = $1
       AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))`,
    [versionId, builderId, companyId]
  );

  if (checkResult.rowCount === 0) throw new Error("Quotation version not found or unauthorized");

  const row = checkResult.rows[0];
  // if (row.esign_envelope_id) throw new Error("Quotation email already sent");
  if (!row.lead_email) throw new Error("Customer email not available");

  const builderIdForTemplate = row.builder_id || builderId;

  // 2. Load QUOTATION_SEND notification template from DB
  const notifTemplate = await NotificationTemplate.findOne({
    where: { builder_id: builderIdForTemplate, template_type: "QUOTATION_SEND", is_active: true },
  });

  if (!notifTemplate) {
    throw new Error(`QUOTATION_SEND notification template not found for builder ${builderIdForTemplate}. Run seeders.`);
  }

  // 3. Full version details for PDF + CC contacts
  const versionDetails = await quotationRepository.getQuotationVersionDetailsById(versionId);
  if (!versionDetails) throw new Error("Quotation version details not found");

  // 4. Generate PDF → upload to S3
  const htmlContent = generateQuotationHTML(versionDetails);
  const pdfBuffer = await generatePDF(htmlContent);
  console.log(`[QuotationEmailWorker] PDF generated for ${versionId}, size: ${pdfBuffer.length} bytes`);

  const s3Key = `quotations/${versionId}/Quotation_v${versionDetails.quotationVersionNo}.pdf`;
  const uploadResult = await uploadFile(s3Key, pdfBuffer, "application/pdf");
  if (!uploadResult.success) throw new Error("Failed to upload PDF to S3");
  await quotationRepository.updatePdfUrl(versionId, uploadResult.location);

  // 5. Build URLs
  const frontendBaseUrl = env.EMAIL.FRONTEND_BASE_URL || "http://localhost:3000";
  const backendBaseUrl = env.EMAIL.BACKEND_BASE_URL;
  const secureHash = encodeQuotationHash(row.quotation_id, row.leads_id);
  const viewUrl = `${frontendBaseUrl}/quotation/view?token=${secureHash}`;

  // 6. Signers + CC
  const signerName = row.lead_name || "Customer";
  const primarySigner = {
    email: row.lead_email,
    name: signerName,
    routingOrder: "1",
    clientUserId: row.lead_email,
  };

  const ccRecipients = (versionDetails.leadContacts || [])
    .filter((c) => c.email && c.email !== row.lead_email)
    .map((c) => ({ email: c.email, name: c.name || c.email, routingOrder: "2" }));

  // 7. Create DocuSign envelope — pass pdfBuffer directly to avoid S3 presigned URL round-trip
  const docusignResult = await docusignService.createQuotationEnvelope(
    versionId,
    {
      signers: [primarySigner],
      ccRecipients,
      emailSubject: `Your Quotation – ${row.reference_number}`,
      emailBlurb: `Please review your quotation (${row.reference_number}) and sign it. View: ${viewUrl}`,
      useEmbeddedSigning: true,
      pdfBuffer,
    },
    userId,
    row.leads_id
  );

  const { envelopeId } = docusignResult;

  await client.query(
    "UPDATE quotation_version SET esign_status = $1, esign_envelope_id = $2 WHERE quotation_version_id = $3",
    ["sent", envelopeId, versionId]
  );

  // 8. Build sign token → URL that decodes + creates 5-min DocuSign signing URL
  const signToken = encodeSignToken(envelopeId, row.lead_email, signerName);
  const signUrl = `${backendBaseUrl}/docusign/public/sign?token=${signToken}`;

  const presignedResult = await generatePresignedDownloadUrl(s3Key, 604800);
  const downloadUrl = presignedResult.success ? presignedResult.url : uploadResult.location;

  // 9. Render template — {{variable}} replaced, literal $ signs untouched
  const templateContext = {
    customerName: signerName,
    referenceNumber: row.reference_number,
    versionNo: versionDetails.quotationVersionNo,
    signUrl,
    viewUrl,
    downloadUrl,
  };

  const renderedTitle = renderTemplate(notifTemplate.title, templateContext);
  const renderedBody = renderTemplate(notifTemplate.body, templateContext);

  // 10. Send one email with proper CC
  const ccEmailList = ccRecipients.map((c) => c.email);
  const plainText = `Dear ${signerName}, your quotation ${row.reference_number} is ready. Sign here: ${signUrl}`;

  await sendEmail(
    row.lead_email,
    renderedTitle,
    plainText,
    renderedBody,
    [],
    ccEmailList.length > 0 ? ccEmailList : null
  );

  // 11. Log sent notification to notifications table
  await Notifications.create({
    sender_id: userId || null,
    receiver_info: JSON.stringify({
      to: row.lead_email,
      cc: ccEmailList,
      name: signerName,
    }),
    template_id: notifTemplate.notification_template_id,
    notification_type: "EMAIL",
    title: renderedTitle,
    body: `Quotation ${row.reference_number} sent for signing. EnvelopeId: ${envelopeId}`,
    metadata_json: JSON.stringify({
      quotationVersionId: versionId,
      quotationId: row.quotation_id,
      envelopeId,
      referenceNumber: row.reference_number,
    }),
    delivery_status: "SENT",
  });

  console.log(`[QuotationEmailWorker] Job complete — versionId: ${versionId}, envelopeId: ${envelopeId}`);
  return { success: true, envelopeId };
});

quotationEmailQueue.on("failed", async (job, err) => {
  const { versionId, userId } = job.data;
  console.error(`[QuotationEmailWorker] Job ${job.id} failed for versionId ${versionId}:`, err.message);

  // Log failure to notifications table if all retries exhausted
  if (job.attemptsMade >= job.opts.attempts) {
    try {
      const { Notifications } = db;
      await Notifications.create({
        sender_id: userId || null,
        receiver_info: JSON.stringify({ versionId }),
        template_id: null,
        notification_type: "EMAIL",
        title: "Quotation email delivery failed",
        body: `Failed to send quotation email for version ${versionId}`,
        metadata_json: JSON.stringify({ quotationVersionId: versionId, error: err.message }),
        delivery_status: "FAILED",
        failure_reason: err.message.slice(0, 500),
      });
    } catch (logErr) {
      console.error("[QuotationEmailWorker] Failed to log failure to notifications table:", logErr.message);
    }
  }
});

quotationEmailQueue.on("completed", (job, result) => {
  console.log(`[QuotationEmailWorker] Job ${job.id} completed, envelopeId: ${result.envelopeId}`);
});

console.log("Quotation email worker started...");

export default quotationEmailQueue;
