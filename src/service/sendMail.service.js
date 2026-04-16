import Bull from "bull";
import { env } from "../config/env.config.js";

const notificationQueue = new Bull("notificationQueue", {
  redis: {
    host: env.REDIS.REDIS_HOST,
    port: env.REDIS.REDIS_PORT,
    password: env.REDIS.REDIS_PASSWORD
  },
});

const sendEmail = async (to, subject, text, html = null, attachments = []) => {
  try {
    await notificationQueue.add({
      to,
      subject,
      text,
      html,
      attachments,
    });

    return {
      success: true,
      message: "Email queued successfully",
    };
  } catch (error) {
    console.error("Error queuing email:", error.message);
    throw error;
  }
};

export default sendEmail;
