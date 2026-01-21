const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.GMAIL,
    pass: process.env.PASSWORD,
  },
});

const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL,
      to,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${subject}</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${text}</pre>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    if (info.accepted && info.accepted.length > 0) {
      return {
        success: true,
        message: "Email sent successfully",
        info: info.response,
        messageId: info.messageId,
        accepted: info.accepted,
      };
    } else {
      console.error("Email was not accepted by any recipient");
      return {
        success: false,
        message: "Email was not accepted",
        info: info.response,
      };
    }
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
};

module.exports = sendEmail;
