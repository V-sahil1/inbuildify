
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
    };

    const info = await transporter.sendMail(mailOptions);
    if (info.accepted && info.accepted.length > 0) {
      return {
        success: true,
        message: "Email sent successfully",
        info: info.response,
      };
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = sendEmail;
