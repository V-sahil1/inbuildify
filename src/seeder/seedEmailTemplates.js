import getPool from "../config/database.js";

const seedEmailTemplates = async () => {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    console.log("🌱 Starting email_templates seeding...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_key VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        cta_text VARCHAR(100),
        cta_link TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    const templates = [
      {
        key: "password_reset",
        category: "Authentication",
        subject: "CRMSimplify - Password Reset Request",
        title: "Reset Your Password",
        message: `Hello,<br/><br/>We received a request to reset your CRMSimplify account password. 
        For your account's security, this link will remain active for the next <b>10 minutes</b>. 
        Please click the button below to securely create a new password and regain access to your account.<br/><br/>
        If you did not make this request, please contact our support team immediately so we can help safeguard your account.`,
        cta_text: "Reset Password",
        cta_link: "${process.env.FRONTEND_BASE_URL}/auth/reset-password?token=${resetPasswordToken}&email=${email}",
      },
      {
        key: "invite_user",
        category: "User Onboarding",
        subject: "You're Invited to Join CRMSimplify",
        title: "Welcome to CRMSimplify",
        message: `Hi,<br/><br/>You have been invited to join <b>CRMSimplify</b>. 
        This platform will help streamline project communication, manage contractors, and track client progress seamlessly. 
        Please click the button below to accept your invitation and set up your account.<br/><br/>
        Once your account is set up, you'll be able to collaborate, track updates, and access all tools provided by your team.`,
        cta_text: "Accept Invitation",
        cta_link: "${process.env.FRONTEND_BASE_URL}/auth/accept-invite?token=${inviteToken}&email=${email}",
      },
      {
        key: "quote_accepted",
        category: "Project",
        subject: "Your Quote Has Been Accepted",
        title: "Quote Accepted – Next Steps",
        message: `Hello,<br/><br/>Great news! Your quote has been accepted by the client. 
        You can now proceed with the next steps of the project planning process. 
        Please log in to your CRMSimplify dashboard to review the project details, confirm timelines, and start working with your client.<br/><br/>
        Our system ensures all communication and documentation are stored securely for easy access throughout the project.`,
        cta_text: "View Project",
        cta_link: "${process.env.FRONTEND_BASE_URL}/dashboard/projects/${projectId}",
      },
      {
        key: "new_message",
        category: "Communication",
        subject: "You Have a New Message",
        title: "New Message Notification",
        message: `Hello,<br/><br/>You have received a new message in your CRMSimplify account. 
        Staying updated helps ensure smoother collaboration and faster progress. 
        Please click below to log in and check the message details.<br/><br/>
        Keeping all communication within CRMSimplify ensures that nothing gets lost in emails or calls.`,
        cta_text: "Read Message",
        cta_link: "${process.env.FRONTEND_BASE_URL}/dashboard/messages/${messageId}",
      },
      {
        key: "payment_confirmation",
        category: "Payments",
        subject: "Payment Confirmation – CRMSimplify",
        title: "Payment Successful",
        message: `Hello,<br/><br/>We are pleased to confirm that we have received your payment for the project. 
        The payment details have been securely recorded in your CRMSimplify account.<br/><br/>
        You can log in to your dashboard anytime to view invoices, track payment history, and manage your financial records.`,
        cta_text: "View Invoice",
        cta_link: "${process.env.FRONTEND_BASE_URL}/dashboard/payments/${paymentId}",
      },
    ];

    for (const template of templates) {
      await client.query(
        `
        INSERT INTO email_templates (template_key, category, subject, title, message, cta_text, cta_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (template_key) DO NOTHING;
        `,
        [
          template.key,
          template.category,
          template.subject,
          template.title,
          template.message,
          template.cta_text,
          template.cta_link,
        ],
      );
    }

    console.log("✅ Email templates seeding completed.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    client.release();
    process.exit(0);
  }
};

seedEmailTemplates();
