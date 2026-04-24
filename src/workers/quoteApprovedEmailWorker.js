import Bull from "bull";
import { env } from "../config/env.config.js";
import getPool from "../config/database.js";
import db from "../config/database/models/postgre-models/index.js";
import { sendMailNotification } from "../service/mailNotification.service.js";

const redisConfig = {
  host: env.REDIS.REDIS_HOST,
  port: env.REDIS.REDIS_PORT,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

const quotationEmailQueue = new Bull("quotationEmailQueue", { redis: redisConfig });

quotationEmailQueue.process(async (job) => {
  const { quotationVersionId, envelopeId } = job.data;
  const client = getPool();

  // Fetch quotation + lead + property + structural engineer in one query
  const result = await client.query(
    `SELECT
        qv.quotation_version_id,
        qv.quotation_version_no,
        q.reference_number        AS quote_reference,
        (
          COALESCE((SELECT DISTINCT package_cost FROM quotation_version_items qvi2
                    WHERE qvi2.quotation_version_id = qv.quotation_version_id
                      AND qvi2.package_id IS NOT NULL LIMIT 1), 0)
          + COALESCE((SELECT SUM(total_price) FROM quotation_version_items qvi3
                      WHERE qvi3.quotation_version_id = qv.quotation_version_id
                        AND qvi3.package_id IS NULL), 0)
          + COALESCE(qv.structure_engineer_price, 0)
          + COALESCE(qv.facade_price, 0)
        )                         AS grand_total,
        l.leads_id,
        l.name                    AS lead_name,
        l.email                   AS lead_email,
        l.phone                   AS lead_phone,
        l.reference_number        AS lead_reference,
        l.builder_id,
        l.company_id,
        se.structure_engineer_id,
        se.name                   AS engineer_name,
        se.email                  AS engineer_email,
        se.phone                  AS engineer_phone,
        pd.lot_number,
        pd.street,
        pd.address_line1,
        pd.address_line2,
        pd.city,
        pd.zip_code,
        pd.width_m,
        pd.depth_m,
        pd.total_size_m2,
        pd.land_type,
        st.name                   AS state_name
     FROM quotation_version qv
     JOIN quotation q ON qv.quotation_id = q.quotation_id
     JOIN leads l ON q.leads_id = l.leads_id
     LEFT JOIN structure_engineer se ON l.structure_engineer_id = se.structure_engineer_id
     LEFT JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
     LEFT JOIN state st ON pd.state_id = st.state_id
     WHERE qv.quotation_version_id = $1`,
    [quotationVersionId]
  );

  if (result.rowCount === 0) throw new Error(`Quotation version ${quotationVersionId} not found`);
  const row = result.rows[0];

  if (!row.engineer_email) {
    console.log(
      `[QuoteApprovedEmailWorker] No structural engineer email on lead ${row.leads_id} — skipping`
    );
    return { success: true, skipped: true };
  }

  // Lead contacts
  const contactsResult = await client.query(
    `SELECT u.name, u.email, u.phone
       FROM leads_contact_map lcm
       JOIN users u ON lcm.contact_id = u.users_id
      WHERE lcm.leads_id = $1`,
    [row.leads_id]
  );

  const contactsHtml =
    contactsResult.rows.length > 0
      ? contactsResult.rows
        .map(
          (c) =>
            `<tr>
               <td style="padding:6px 12px;border-bottom:1px solid #eee;">${c.name || "-"}</td>
               <td style="padding:6px 12px;border-bottom:1px solid #eee;">${c.email || "-"}</td>
               <td style="padding:6px 12px;border-bottom:1px solid #eee;">${c.phone || "-"}</td>
             </tr>`
        )
        .join("")
      : "<tr><td colspan=\"3\" style=\"padding:6px 12px;color:#888;\">No contacts</td></tr>";

  const propertyAddress = [
    row.address_line1,
    row.address_line2,
    row.city,
    row.state_name,
    row.zip_code,
  ]
    .filter(Boolean)
    .join(", ") || "N/A";

  const context = {
    engineerName: row.engineer_name || "Structural Engineer",
    quoteReference: row.quote_reference,
    quoteVersion: row.quotation_version_no,
    grandTotal: row.grand_total !== null ? `$${Number(row.grand_total).toFixed(2)}` : "N/A",
    leadName: row.lead_name,
    leadReference: row.lead_reference,
    leadEmail: row.lead_email || "N/A",
    leadPhone: row.lead_phone || "N/A",
    propertyAddress,
    lotNumber: row.lot_number || "N/A",
    propertyStreet: row.street || "N/A",
    propertyDimensions: row.width_m && row.depth_m
      ? `W: ${row.width_m}m  D: ${row.depth_m}m  Total: ${row.total_size_m2 || "-"}m²`
      : "N/A",
    landType: row.land_type || "N/A",
    contactsHtml,
  };

  const plainText =
    `Dear ${context.engineerName},\n\n` +
    `Quote ${context.quoteReference} (v${context.quoteVersion}) has been approved.\n\n` +
    `Lead: ${context.leadName} (${context.leadEmail})\n` +
    `Property: ${propertyAddress}\n` +
    `Total: ${context.grandTotal}`;

  await sendMailNotification({
    templateType: "QUOTE_ACCEPTED",
    builderId: row.builder_id,
    companyId: row.company_id,
    to: row.engineer_email,
    context,
    metadata: {
      quotationVersionId,
      envelopeId,
      leadsId: row.leads_id,
      quoteReference: row.quote_reference,
    },
    senderId: null,
    plainText,
  });

  console.log(
    `[QuoteApprovedEmailWorker] Sent to ${row.engineer_email} for quote ${row.quote_reference}`
  );
  return { success: true, engineerEmail: row.engineer_email };
});

quotationEmailQueue.on("failed", async (job, err) => {
  console.log("🚀 ~ quoteApprovedEmailWorker.js:159 ~ job:", job.data);
  const { quotationVersionId } = job.data;
  console.error(
    `[QuoteApprovedEmailWorker] Job ${job.id} failed for version ${quotationVersionId}:`,
    err.message
  );

  if (job.attemptsMade >= job.opts.attempts) {
    try {
      const { Notifications } = db;
      await Notifications.create({
        sender_id: null,
        receiver_info: JSON.stringify({ quotationVersionId }),
        template_id: null,
        notification_type: "EMAIL",
        title: "Quote approved — structural engineer email failed",
        body: `Failed to send approval email for version ${quotationVersionId}`,
        metadata_json: JSON.stringify({ quotationVersionId, error: err.message }),
        delivery_status: "FAILED",
        failure_reason: err.message.slice(0, 500),
      });
    } catch (logErr) {
      console.error("[QuoteApprovedEmailWorker] Failed to log failure:", logErr.message);
    }
  }
});

quotationEmailQueue.on("completed", (job, result) => {
  console.log(`[QuoteApprovedEmailWorker] Job ${job.id} completed:`, result);
});

console.log("Quote approved email worker started...");

export default quotationEmailQueue;
