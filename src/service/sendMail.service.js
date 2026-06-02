import notificationQueue from "../workers/notificationWorker.js";

const sendEmail = async (
  to,
  subject,
  text,
  html = null,
  attachments = [],
  cc = null,
  attachmentKeys = [],
) => {
  try {
    await notificationQueue.add(
      {
        to,
        subject,
        text,
        html,
        attachments,
        cc,
        attachmentKeys,
      },
      {
        // Prevent Redis OOM: don't keep completed jobs; cap failed history.
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );

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
