import Bull from "bull";
import nodemailer from "nodemailer";
import { PDFDocument } from "pdf-lib";
import { env } from "../config/env.config.js";
import { generateEngineerPdfHtml } from "../utils/engineerPdfTemplate.js";
import { generatePDF } from "../modules/quotation/pdf.service.js";
import { getObject, generatePresignedDownloadUrl, uploadFile } from "../service/s3.service.js";
import { upsertQuotationDriveFile } from "../helper/quotationDriveFile.helper.js";
import { DRIVE_FILE_MAPPING } from "../constants/driveFile.js";

import { createSharedBullClient } from "../config/redisBull.config.js";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",      // 👈 explicit instead of service: "Gmail"
  port: 587,                   // 👈 explicit port
  secure: false,               // false for 587 (STARTTLS)
  requireTLS: true,
  auth: {
    user: env.EMAIL.GMAIL,
    pass: env.EMAIL.PASSWORD,
  },
});

const generateEngineerEmailHtml = (subject, text, pdfData) => {
  const { range, dwellingType, floorPlan, facade, package: pkg, propertyDetail, leadId, versionId } = pdfData;

  const lotNo = propertyDetail?.lot_number || "N/A";
  const street = propertyDetail?.street || "N/A";
  const city = propertyDetail?.city || "N/A";
  const postcode = propertyDetail?.zip_code || "N/A";
  const address = lotNo !== "N/A" || street !== "N/A" ? `Lot ${lotNo}, ${street}, ${city} ${postcode}` : "N/A";

  const rangeName = range?.name || "N/A";
  const floorPlanName = floorPlan?.name || "N/A";
  const facadeName = facade?.name || "N/A";
  const packageName = pkg?.name || "N/A";

  const compactionReportDownloadUrl = propertyDetail?.compaction_report_download_url || "";
  const structureEngineerReportDownloadUrl = pdfData.structureEngineerReportDownloadUrl || "";
  const fallbackS3Url = (pdfData.versionId) 
    ? `https://${env.AWS.S3_BUCKET_NAME}.s3.${env.AWS.AWS_REGION}.amazonaws.com/quotations/${pdfData.versionId}/Engineering_Requirement.pdf`
    : "";
  const engineeringRequirementDownloadUrl = pdfData.engineeringRequirementDownloadUrl || fallbackS3Url;

  const frontendBaseUrl = env.EMAIL.FRONTEND_BASE_URL || "http://localhost:3000";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; padding: 40px 10px; margin: 0; min-height: 100%;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #eef2f5;">
        <!-- Header -->
        <tr>
          <td style="background-color: #0056b3; padding: 30px 40px; text-align: left;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">inBuildify</span>
                </td>
                <td style="text-align: right;">
                  <span style="font-size: 11px; font-weight: 700; color: #b3d7ff; text-transform: uppercase; letter-spacing: 1px; background-color: rgba(255, 255, 255, 0.15); padding: 4px 10px; border-radius: 4px;">Engineering Request</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding: 40px 40px 30px 40px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 0; margin-bottom: 20px; line-height: 1.3;">
              ${subject}
            </h2>
            
            <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-top: 0; margin-bottom: 25px; white-space: pre-wrap;">${text}</p>
            
            <!-- Specs Card -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; border-collapse: separate; overflow: hidden;">
              <tr>
                <td colspan="2" style="background-color: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0;">
                  <strong style="font-size: 13px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Specification Summary</strong>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 20px 8px 20px; font-size: 14px; color: #64748b; width: 40%;">Property Address:</td>
                <td style="padding: 16px 20px 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${address}</td>
              </tr>
              <tr>
                <td style="padding: 8px 20px; font-size: 14px; color: #64748b;">Range:</td>
                <td style="padding: 8px 20px 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${rangeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 20px; font-size: 14px; color: #64748b;">Floor Plan:</td>
                <td style="padding: 8px 20px 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${floorPlanName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 20px; font-size: 14px; color: #64748b;">Facade Option:</td>
                <td style="padding: 8px 20px 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${facadeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 20px 16px 20px; font-size: 14px; color: #64748b; border-bottom: none;">Selected Package:</td>
                <td style="padding: 8px 20px 16px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right; border-bottom: none;">${packageName}</td>
              </tr>
            </table>

            <!-- Call to Actions -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
              <tr>
                <td style="text-align: center; padding-bottom: 15px;">
                  <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 10px;">Please use the buttons below to access your documents and submit reports.</span>
                </td>
              </tr>
              ${(versionId || leadId) ? `
              <tr>
                <td style="text-align: center; padding-bottom: 16px;">
                  <a href="${frontendBaseUrl}/external?Type=structuralengineer&id=${versionId}" target="_blank" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 6px 16px rgba(249, 115, 22, 0.25); width: 280px; text-align: center; transition: all 0.2s ease-in-out;">
                    📤 Upload Report
                  </a>
                </td>
              </tr>
              ` : ''}
              ${engineeringRequirementDownloadUrl ? `
              <tr>
                <td style="text-align: center; padding-bottom: 12px;">
                  <a href="${engineeringRequirementDownloadUrl}" target="_blank" style="display: inline-block; background-color: #0056b3; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 6px rgba(0, 86, 179, 0.15); width: 280px; text-align: center;">
                    📥 Download Engineering Requirement
                  </a>
                </td>
              </tr>
              ` : ''}
              ${compactionReportDownloadUrl ? `
              <tr>
                <td style="text-align: center; padding-bottom: 12px;">
                  <a href="${compactionReportDownloadUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.15); width: 280px; text-align: center;">
                    📥 Download Soild Compaction Report
                  </a>
                </td>
              </tr>
              ` : ''}
              ${structureEngineerReportDownloadUrl ? `
              <tr>
                <td style="text-align: center;">
                  <a href="${structureEngineerReportDownloadUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.15); width: 280px; text-align: center;">
                    📥 Download Structural Eng. Report
                  </a>
                </td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #eef2f5;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 8px 0;">This email is automated regarding structural engineering requirements.</p>
            <p style="font-size: 12px; font-weight: 600; color: #64748b; margin: 0;"><strong>inBuildify</strong> | Modern Construction & CRM Solutions</p>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const engineerEmailQueue = new Bull("engineerEmailQueue", { createClient: createSharedBullClient });

engineerEmailQueue.process(async (job) => {
  const { email, subject, text, html, pdfData, versionId } = job.data;
  let uploadedS3Url = null;
  let uploadedS3Key = null;
  let uploadedPdfSize = null;

  if (!email) {
    throw new Error("No email address provided in job data");
  }

  let attachments = [];

  if (pdfData) {
    try {
      const getBase64Image = async (keyOrUrl) => {
        if (!keyOrUrl) return null;
        if (keyOrUrl.startsWith("data:")) return keyOrUrl;
        if (keyOrUrl.startsWith("blob:")) {
          return keyOrUrl;
        }

        let key = keyOrUrl;
        try {
          if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
            const parsed = new URL(keyOrUrl);
            let keyPath = parsed.pathname;
            if (keyPath.startsWith("/")) {
              keyPath = keyPath.substring(1);
            }
            key = decodeURIComponent(keyPath);
            console.log(`[EngineerEmailWorker] Parsed S3 Key for image: "${key}" from URL: "${keyOrUrl}"`);
          }
        } catch (e) {
       
        }

        console.log(`[EngineerEmailWorker] Downloading image to Base64 for key: ${key}`);
        const result = await getObject(key);
        if (result?.success && result?.data) {
          const base64 = result.data.toString("base64");
          const mimeType = result.contentType || "image/png";
          return `data:${mimeType};base64,${base64}`;
        }
        return keyOrUrl; // Fallback to original URL/key if download fails
      };

      if (pdfData.range) {
        pdfData.range.logo_url = await getBase64Image(pdfData.range.logo_url);
        pdfData.range.header_url = await getBase64Image(pdfData.range.header_url);
      }
      if (pdfData.floorPlan) {
        pdfData.floorPlan.detailed_image = await getBase64Image(pdfData.floorPlan.detailed_image);
        pdfData.floorPlan.simple_image = await getBase64Image(pdfData.floorPlan.simple_image);
      }
      if (pdfData.facade) {
        pdfData.facade.image = await getBase64Image(pdfData.facade.image);
      }

      const processAndAttachReport = async (urlOrKey, defaultName, shouldAttach = true) => {
        if (!urlOrKey) return null;
        if (urlOrKey.startsWith("blob:")) {
          console.warn(`[EngineerEmailWorker] Skipping invalid blob URL for ${defaultName}: ${urlOrKey}`);
          return null;
        }

        let reportKey = urlOrKey;
        try {
          if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
            const parsed = new URL(urlOrKey);
            let keyPath = parsed.pathname;
            if (keyPath.startsWith("/")) {
              keyPath = keyPath.substring(1);
            }
            reportKey = decodeURIComponent(keyPath);
            console.log(`[EngineerEmailWorker] Parsed S3 Key for report: "${reportKey}" from URL: "${urlOrKey}"`);
          }
        } catch (e) {
          // Treat as raw key
        }

        let presignedUrl = null;
        // 1. Generate 7 days presigned URL for the PDF button/link
        try {
          const presignedResult = await generatePresignedDownloadUrl(reportKey, 604800); // 7 days (604,800 seconds)
          if (presignedResult?.success) {
            presignedUrl = presignedResult.url;
            console.log(`[EngineerEmailWorker] Generated 7-day presigned URL for ${defaultName}: ${presignedUrl}`);
          }
        } catch (presignedErr) {
          console.error(`[EngineerEmailWorker] Error generating presigned link for ${defaultName}:`, presignedErr.message);
        }

        let fileBuffer = null;
        if (shouldAttach) {
          // 2. Fetch binary content and attach it directly as an email attachment
          try {
            const reportFileResult = await getObject(reportKey);
            if (reportFileResult?.success && reportFileResult?.data) {
              fileBuffer = reportFileResult.data;
              attachments.push({
                filename: defaultName,
                content: fileBuffer,
              });
              console.log(`[EngineerEmailWorker] Attached file: ${defaultName}`);
            }
          } catch (attachErr) {
            console.error(`[EngineerEmailWorker] Error downloading report for email attachment:`, attachErr.message);
          }
        }

        return { presignedUrl, fileBuffer };
      };

      // Process Compaction Report (must strictly come from property details, else not sent)
      let compactionReportBuffer = null;
      let compactionReportUrl = pdfData.propertyDetail?.compaction_report_url || null;
      if (compactionReportUrl) {
        const result = await processAndAttachReport(compactionReportUrl, "COMPACTION REPORT.pdf", false);
        if (result) {
          const { presignedUrl, fileBuffer } = result;
          if (!pdfData.propertyDetail) pdfData.propertyDetail = {};
          pdfData.propertyDetail.compaction_report_download_url = presignedUrl || compactionReportUrl;
          if (fileBuffer) {
            compactionReportBuffer = fileBuffer;
          }
        }
      }

      // Process Structural Engineer Report
      let structureReportBuffer = null;
      if (pdfData.structureEngineerReport) {
        const result = await processAndAttachReport(pdfData.structureEngineerReport, "Structural_Engineer_Report.pdf");
        if (result) {
          const { presignedUrl, fileBuffer } = result;
          pdfData.structureEngineerReportDownloadUrl = presignedUrl || pdfData.structureEngineerReport;
          if (fileBuffer) {
            structureReportBuffer = fileBuffer;
          }
        }
      }

      const pdfHtml = generateEngineerPdfHtml(pdfData);
      const pdfBuffer = await generatePDF(pdfHtml);

      // Upload the generated PDF to S3 (Engineering Requirement). The DriveFile
      // upsert and column update happen after sendMail succeeds, below.
      if (versionId) {
        const s3Key = `quotations/${versionId}/Engineering_Requirement.pdf`;
        console.log(`[EngineerEmailWorker] Uploading Engineering_Requirement.pdf to S3 at: ${s3Key}`);
        const uploadResult = await uploadFile(s3Key, pdfBuffer, "application/pdf");
        if (uploadResult?.success) {
          uploadedS3Url = uploadResult.location;
          uploadedS3Key = uploadResult.key;
          uploadedPdfSize = pdfBuffer.length;
          console.log(`[EngineerEmailWorker] Successfully uploaded dynamic PDF to S3: ${uploadedS3Url}`);

          // Generate 7 days presigned link for the email download button
          const presignedResult = await generatePresignedDownloadUrl(s3Key, 604800); // 7 days (604,800 seconds)
          if (presignedResult?.success) {
            pdfData.engineeringRequirementDownloadUrl = presignedResult.url;
            console.log(`[EngineerEmailWorker] Generated 7-day presigned URL for Engineering Requirement: ${presignedResult.url}`);
          } else {
            pdfData.engineeringRequirementDownloadUrl = uploadedS3Url;
          }
        } else {
          console.error(`[EngineerEmailWorker] Failed to upload Engineering_Requirement.pdf to S3`);
        }
      }

      console.log(`[EngineerEmailWorker] Final S3 PDF prepared successfully.`);
    } catch (error) {
      console.error(`[EngineerEmailWorker] Failed to generate PDF:`, error.message);
    }
  }

  let emailHtml = html;
  if (pdfData) {
    emailHtml = generateEngineerEmailHtml(subject, text, pdfData);
  } else if (!emailHtml) {
    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${subject}</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
          <div style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${text}</div>
        </div>
      </div>
    `;
  }

  const mailOptions = {
    from: env.EMAIL.GMAIL,
    to: email,
    subject,
    text,
    html: emailHtml,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);

  if (info.accepted && info.accepted.length > 0) {
    console.log(`[EngineerEmailWorker] Sent email to ${email}`);

    if (versionId) {
      try {
        const db = (await import("../config/database/models/postgre-models/index.js")).default;
        const { QuotationVersion } = db;

        // The Engineering Requirement PDF is persisted exclusively as a
        // DriveFile (sub_reference_type=EngineeringRequirement). The legacy
        // quotation_version_detail column is no longer written per the
        // DriveFile migration blueprint.
        if (uploadedS3Key) {
          await upsertQuotationDriveFile({
            versionId,
            subReferenceType: DRIVE_FILE_MAPPING.SUB_REFERENCES.ENGINEERING_REQUIREMENT,
            s3Key: uploadedS3Key,
            size: uploadedPdfSize,
            originalName: "Engineering_Requirement.pdf",
          });
        }

        await QuotationVersion.update(
          { send_to_engineer: true },
          { where: { quotation_version_id: versionId } }
        );
        console.log(`[EngineerEmailWorker] Marked send_to_engineer=true for quotation version: ${versionId}`);
      } catch (dbErr) {
        console.error(`[EngineerEmailWorker] Failed to update quotation version status in background:`, dbErr.message);
      }
    }

    return { success: true, email };
  } else {
    throw new Error(`Email not accepted for ${email}`);
  }
});

engineerEmailQueue.on("failed", (job, err) => {
  console.error(`[EngineerEmailWorker] Job ${job.id} failed for version ${job.data.versionId}:`, err.message);
});

engineerEmailQueue.on("completed", (job, result) => {
  console.log(`[EngineerEmailWorker] Job ${job.id} completed:`, result);
});

console.log("Engineer email worker started...");

export default engineerEmailQueue;
