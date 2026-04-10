import Bull from "bull";
import nodemailer from "nodemailer";
import { env } from "../config/env.config.js";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: env.EMAIL.GMAIL,
    pass: env.EMAIL.PASSWORD,
  },
});

const notificationQueue = new Bull("notificationQueue", {
  redis: { host: env.REDIS.REDIS_HOST, port: env.REDIS.REDIS_PORT, password: env.REDIS.REDIS_PASSWORD },
});

notificationQueue.process(async (job) => {
  const { to, subject, text, html, attachments } = job.data;

  try {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const htmlContent = text.replace(
      linkRegex,
      "<a href=\"$1\" style=\"color: #007bff; text-decoration: none;\">$1</a>",
    );

    const mailOptions = {
      from: env.EMAIL.GMAIL,
      to,
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
      attachments,
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
