import Bull from "bull";
import nodemailer from "nodemailer";
import { env } from "../config/env.config.js";
import { getObject } from "../service/s3.service.js";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: env.EMAIL.GMAIL,
    pass: env.EMAIL.PASSWORD,
  },
  // Reuse SMTP connections instead of dialing a fresh one per email — fewer
  // handshakes means fewer "Connection timeout" failures under bursts/throttling.
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  // Bound connection setup so a dead SMTP host fails fast and the job can retry.
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  // Engineer emails attach the Engineering Requirement PDF, which can be several
  // MB. A 6 MB attachment takes ~60s to upload to Gmail — a short socket timeout
  // aborts mid-upload as "Timeout" and the mail never sends. Keep the data
  // socket open long enough for large attachments (stays under Bull lockDuration).
  socketTimeout: 180000,
});

import { createSharedBullClient } from "../config/redisBull.config.js";

const notificationQueue = new Bull("notificationQueue", {
  createClient: createSharedBullClient,
  // The engineer-email path downloads PDF attachments from S3 inside the
  // processor before sending. With remote Redis latency, that work can exceed
  // Bull's default 30s lock window, causing "job stalled"/"Missing lock"
  // failures (engineer emails never sent). Widen the lock and stall window.
  settings: {
    lockDuration: 300000, // 5 min — long enough for S3 attachment download + SMTP send
    stalledInterval: 60000,
    maxStalledCount: 1,
  },
});

notificationQueue.process(async (job) => {
  const { to, subject, text, html, attachments = [], cc, attachmentKeys = [] } = job.data;

  try {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const htmlContent = text.replace(
      linkRegex,
      "<a href=\"$1\" style=\"color: #007bff; text-decoration: none;\">$1</a>",
    );

    // Resolve attachmentKeys (S3 references) into real attachments here so the
    // PDF bytes never sit in Redis as base64 — that's what tripped OOM on the
    // engineer email path.
    const resolvedAttachments = Array.isArray(attachments) ? [...attachments] : [];
    for (const item of attachmentKeys) {
      if (!item?.key) continue;
      try {
        const obj = await getObject(item.key);
        if (obj?.success && obj?.data) {
          resolvedAttachments.push({
            filename: item.filename,
            content: obj.data,
            contentType: item.contentType || obj.contentType || "application/octet-stream",
          });
        } else {
          console.error(`Failed to fetch S3 attachment ${item.key}: ${obj?.error || "no data"}`);
        }
      } catch (e) {
        console.error(`Error fetching S3 attachment ${item.key}:`, e.message);
      }
    }

    const mailOptions = {
      from: env.EMAIL.GMAIL,
      to,
      ...(cc && cc.length > 0 ? { cc } : {}),
      subject,
      text,
      html: html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${subject}</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
            <div style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${htmlContent}</div>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `,
      attachments: resolvedAttachments,
    };

    const info = await transporter.sendMail(mailOptions);

    if (info.accepted && info.accepted.length > 0) {
      return {
        success: true,
        messageId: info.messageId,
        info: info.response,
        accepted: info.accepted,
      };
    }

    console.error(`Email not accepted for ${to}`);
    throw new Error("Email not accepted");
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error.message);
    throw error;
  }
});

notificationQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

notificationQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

console.log("Email worker started and listening for jobs...");

export default notificationQueue;