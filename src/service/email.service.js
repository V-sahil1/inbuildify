const sendEmail = require("../helper/sendMail");

async function sendPasswordEmail(email, loginId, password) {
  const subject = "Your Login Credentials";
  const text = `
Your login credentials have been updated.

Login ID: ${loginId}
Password: ${password}

Please log in and change your password if required.
    `;
  await sendEmail(email, subject, text);
}

async function sendLoginIdEmail(email, loginId) {
  const subject = "Your Login ID Has Changed";
  const text = `
Your login ID has been changed.

New Login ID: ${loginId}

If you did not request this change, please contact support.
    `;
  await sendEmail(email, subject, text);
}

module.exports = {
  sendPasswordEmail,
  sendLoginIdEmail,
};
