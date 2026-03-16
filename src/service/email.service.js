import sendEmail from "../helper/sendMail";

async function sendPasswordEmail(email, loginId, password) {
  try {
    const subject = "Your Login Credentials";
    const text = `
Your login credentials have been updated.

Login ID: ${loginId}
Password: ${password}

Please log in and change your password if required.
    `;
    const result = await sendEmail(email, subject, text);
    return result;
  } catch (error) {
    console.error(`Failed to send password email to ${email}:`, error);
    throw error;
  }
}

async function sendLoginIdEmail(email, loginId) {
  try {
    const subject = "Your Login ID Has Changed";
    const text = `
Your login ID has been changed.

New Login ID: ${loginId}

If you did not request this change, please contact support.
    `;
    const result = await sendEmail(email, subject, text);
    return result;
  } catch (error) {
    console.error(`Failed to send login ID email to ${email}:`, error);
    throw error;
  }
}

export default {
  sendPasswordEmail,
  sendLoginIdEmail,
};
