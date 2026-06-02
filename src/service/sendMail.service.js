import notificationQueue from "../workers/notificationWorker.js";

const sendEmail = async (to, subject, text, html = null, attachments = [], cc = null) => {
  try {
    await notificationQueue.add({
      to,
      subject,
      text,
      html,
      attachments,
      cc,
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
