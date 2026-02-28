/**
 * Seed default template_email records for a new builder.
 * Inserts standard email templates (password reset, invite, quote, message, payment).
 */
async function seedTemplateEmail({ company_id, builder_id, created_by, client }) {
  const templates = [
    {
      name: "Password Reset",
      type: "standard",
      subject: "CRMSimplify - Password Reset Request",
      email_content: `Hello,<br/><br/>We received a request to reset your CRMSimplify account password. For your account's security, this link will remain active for the next <b>10 minutes</b>. Please click the button below to securely create a new password and regain access to your account.<br/><br/>If you did not make this request, please contact our support team immediately so we can help safeguard your account.`,
    },
    {
      name: "Invite User",
      type: "standard",
      subject: "You're Invited to Join CRMSimplify",
      email_content: `Hi,<br/><br/>You have been invited to join <b>CRMSimplify</b>. This platform will help streamline project communication, manage contractors, and track client progress seamlessly. Please click the button below to accept your invitation and set up your account.<br/><br/>Once your account is set up, you'll be able to collaborate, track updates, and access all tools provided by your team.`,
    },
    {
      name: "Quote Accepted",
      type: "standard",
      subject: "Your Quote Has Been Accepted",
      email_content: `Hello,<br/><br/>Great news! Your quote has been accepted by the client. You can now proceed with the next steps of the project planning process. Please log in to your CRMSimplify dashboard to review the project details, confirm timelines, and start working with your client.<br/><br/>Our system ensures all communication and documentation are stored securely for easy access throughout the project.`,
    },
    {
      name: "New Message",
      type: "standard",
      subject: "You Have a New Message",
      email_content: `Hello,<br/><br/>You have received a new message in your CRMSimplify account. Staying updated helps ensure smoother collaboration and faster progress. Please click below to log in and check the message details.<br/><br/>Keeping all communication within CRMSimplify ensures that nothing gets lost in emails or calls.`,
    },
    {
      name: "Payment Confirmation",
      type: "standard",
      subject: "Payment Confirmation – CRMSimplify",
      email_content: `Hello,<br/><br/>We are pleased to confirm that we have received your payment for the project. The payment details have been securely recorded in your CRMSimplify account.<br/><br/>You can log in to your dashboard anytime to view invoices, track payment history, and manage your financial records.`,
    },
    // Customized templates
    {
      name: "Welcome Email",
      type: "customized",
      subject: "Welcome to CRMSimplify",
      email_content: `Hello,<br/><br/>Welcome to <b>CRMSimplify</b>! Your account has been successfully created. We're excited to have you on board.<br/><br/>Please log in to your dashboard to explore all the features and start managing your projects efficiently.`,
    },
    {
      name: "Appointment Reminder",
      type: "customized",
      subject: "Appointment Reminder – CRMSimplify",
      email_content: `Hello,<br/><br/>This is a reminder about your upcoming appointment. Please make sure to prepare any necessary documents and arrive on time.<br/><br/>If you need to reschedule, please contact us as soon as possible.`,
    },
    {
      name: "Construction Update",
      type: "customized",
      subject: "Construction Progress Update",
      email_content: `Hello,<br/><br/>We would like to update you on the progress of your construction project. The latest stage has been completed and we are moving forward as planned.<br/><br/>Please log in to your portal to view detailed progress reports and photos.`,
    },
    {
      name: "Maintenance Request",
      type: "customized",
      subject: "Maintenance Request Received",
      email_content: `Hello,<br/><br/>We have received your maintenance request and it has been logged in our system. Our team will review the request and get back to you with the next steps.<br/><br/>You can track the status of your request through your customer portal.`,
    },
    {
      name: "Color Selection Reminder",
      type: "customized",
      subject: "Reminder: Complete Your Color Selections",
      email_content: `Hello,<br/><br/>This is a friendly reminder that your color selections are still pending. Please log in to your portal to complete your selections before the deadline to avoid any delays in your project timeline.<br/><br/>If you have any questions regarding the available options, please don't hesitate to contact us.`,
    },
  ];

  for (const tpl of templates) {
    await client.query(
      `INSERT INTO template_email (
        company_id, builder_id, name, type, subject, email_content,
        is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
      ON CONFLICT (company_id, builder_id, name) DO NOTHING`,
      [company_id, builder_id, tpl.name, tpl.type, tpl.subject, tpl.email_content, created_by]
    );
  }
}

module.exports = { seedTemplateEmail };
