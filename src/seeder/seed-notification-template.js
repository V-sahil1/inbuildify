/**
 * Seeds default notification_template records for a new builder.
 * Template body uses {{variable}} placeholders — literal $ signs are safe for currency amounts.
 */
import db from "../config/database/models/postgre-models/index.js";

const QUOTATION_SEND_BODY = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    <div style="background:#0056b3;color:#ffffff;padding:20px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">Your Quotation is Ready to Sign</h1>
    </div>
    <div style="padding:30px;line-height:1.6;color:#333333;">
      <p>Dear {{customerName}},</p>
      <p>Your quotation <strong>{{referenceNumber}}</strong> (Version {{versionNo}}) has been prepared and is ready for your review and signature.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{signUrl}}"
           style="display:inline-block;background:#e67e22;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
          Sign Quotation
        </a>
      </div>
      <div style="text-align:center;margin:10px 0 20px;">
        <a href="{{viewUrl}}"
           style="display:inline-block;background:#0056b3;color:#ffffff;padding:10px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">
          View Quotation Details
        </a>
      </div>
      <p style="text-align:center;margin-top:10px;">
        <a href="{{downloadUrl}}" style="color:#0056b3;font-size:14px;">Download PDF</a>
      </p>
      <p style="font-size:13px;color:#888888;text-align:center;">PDF download link valid for 7 days.</p>
      <p>If you have any questions, please do not hesitate to reach out.</p>
      <p style="margin-top:25px;">Best regards,<br><strong>InBuildify Team</strong></p>
    </div>
    <div style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777777;">
      This is an automated message. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;

const QUOTE_ACCEPTED_BODY = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    <div style="background:#1a5276;color:#ffffff;padding:22px;text-align:center;">
      <h1 style="margin:0;font-size:22px;">Quote Approved — Structural Engineering Assignment</h1>
    </div>
    <div style="padding:28px;line-height:1.7;color:#333333;">
      <p>Dear {{engineerName}},</p>
      <p>A quotation has been <strong>approved by the client</strong>. Please find the full details below for your records and action.</p>

      <h3 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:6px;margin-top:24px;">Quotation Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;width:45%;color:#666;">Reference</td><td style="padding:6px 0;font-weight:bold;">{{quoteReference}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Version</td><td style="padding:6px 0;">{{quoteVersion}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Total Amount</td><td style="padding:6px 0;font-weight:bold;color:#1a5276;">{{grandTotal}}</td></tr>
      </table>

      <h3 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:6px;margin-top:24px;">Lead Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;width:45%;color:#666;">Lead Name</td><td style="padding:6px 0;font-weight:bold;">{{leadName}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Lead Reference</td><td style="padding:6px 0;">{{leadReference}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;">{{leadEmail}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">{{leadPhone}}</td></tr>
      </table>

      <h3 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:6px;margin-top:24px;">Property Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;width:45%;color:#666;">Address</td><td style="padding:6px 0;">{{propertyAddress}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Street</td><td style="padding:6px 0;">{{propertyStreet}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Lot Number</td><td style="padding:6px 0;">{{lotNumber}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Dimensions</td><td style="padding:6px 0;">{{propertyDimensions}}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Land Type</td><td style="padding:6px 0;">{{landType}}</td></tr>
      </table>

      <h3 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:6px;margin-top:24px;">Lead Contacts</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e0e0e0;border-radius:4px;">
        <thead>
          <tr style="background:#f0f4fa;">
            <th style="padding:8px 12px;text-align:left;color:#1a5276;">Name</th>
            <th style="padding:8px 12px;text-align:left;color:#1a5276;">Email</th>
            <th style="padding:8px 12px;text-align:left;color:#1a5276;">Phone</th>
          </tr>
        </thead>
        <tbody>
          {{contactsHtml}}
        </tbody>
      </table>

      <p style="margin-top:28px;">Please proceed with the structural engineering assessment at your earliest convenience.</p>
      <p>Best regards,<br><strong>InBuildify Team</strong></p>
    </div>
    <div style="background:#f1f1f1;padding:14px;text-align:center;font-size:12px;color:#777777;">
      This is an automated message. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;

export const WELCOME_EMAIL_BODY = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    <div style="background:#0056b3;color:#ffffff;padding:24px 30px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">Welcome to {{builderName}}</h1>
    </div>
    <div style="padding:30px;line-height:1.6;color:#333333;">
      <p>Dear {{leadName}},</p>
      <p>Thank you for your interest in building with <strong>{{builderName}}</strong>. We are thrilled to have the opportunity to work with you and help bring your vision to life.</p>
      <p>Our team is dedicated to providing you with the highest quality service and guidance throughout your building journey.</p>
      <p>If you have any questions or would like to schedule a consultation, please don't hesitate to reach out to us.</p>
      <p style="margin-top:25px;">Best regards,<br><strong>The {{builderName}} Team</strong></p>
    </div>
    <div style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777777;">
      This is an automated message. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;

export async function seedNotificationTemplate({ company_id, builder_id, transaction }) {
  const { NotificationTemplate } = db;

  await NotificationTemplate.findOrCreate({
    where: {
      builder_id,
      template_type: "QUOTATION_SEND",
    },
    defaults: {
      company_id: company_id || null,
      builder_id,
      notification_type: "EMAIL",
      template_type: "QUOTATION_SEND",
      title: "Your Quotation – {{referenceNumber}}",
      body: QUOTATION_SEND_BODY,
      is_active: true,
    },
    transaction,
  });

  await NotificationTemplate.findOrCreate({
    where: {
      builder_id,
      template_type: "QUOTE_ACCEPTED",
    },
    defaults: {
      company_id: company_id || null,
      builder_id,
      notification_type: "EMAIL",
      template_type: "QUOTE_ACCEPTED",
      title: "Quote Approved – {{quoteReference}} | {{leadName}}",
      body: QUOTE_ACCEPTED_BODY,
      is_active: true,
    },
    transaction,
  });

  await NotificationTemplate.findOrCreate({
    where: {
      builder_id,
      template_type: "WELCOME_EMAIL",
    },
    defaults: {
      company_id: company_id || null,
      builder_id,
      notification_type: "EMAIL",
      template_type: "WELCOME_EMAIL",
      title: "Welcome to {{builderName}}!",
      body: WELCOME_EMAIL_BODY,
      is_active: true,
    },
    transaction,
  });
}

export default { seedNotificationTemplate };

