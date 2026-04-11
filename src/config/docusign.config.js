import { env } from "./env.config.js";

const docusignConfig = {
  // DocuSign API configuration
  basePath: env.DOCUSIGN.BASE_URL,
  oAuthBasePath: env.DOCUSIGN.OAUTH_BASE_PATH,
  
  // Authentication
  clientId: env.DOCUSIGN.CLIENT_ID,
  userId: env.DOCUSIGN.USER_ID,
  rsaKey: env.DOCUSIGN.RSA_KEY,
  
  // Webhook configuration
  webhookUrl: env.DOCUSIGN.WEBHOOK_URL,
  webhookSecret: env.DOCUSIGN.WEBHOOK_SECRET,
  
  // Template settings
  defaultTemplateId: env.DOCUSIGN.QUOTATION_TEMPLATE_ID,
  agreementTemplateId: env.DOCUSIGN.AGREEMENT_TEMPLATE_ID,
  
  // Email settings
  defaultEmailSubject: {
    quotation: "Please review and sign your quotation",
    agreement: "Please review and sign your agreement"
  },
  
  defaultEmailMessage: {
    quotation: "Please review the attached quotation and sign it at your earliest convenience.",
    agreement: "Please review the attached agreement and sign it at your earliest convenience."
  },
  
  // Signing settings
  signingRedirectUrl: env.DOCUSIGN.SIGNING_REDIRECT_URL || "https://yourapp.com/signing-complete",
  expirationDays: env.DOCUSIGN.EXPIRATION_DAYS,
  
  // Status mappings
  envelopeStatus: {
    sent: "sent",
    delivered: "delivered", 
    completed: "completed",
    declined: "declined",
    voided: "voided"
  },
  
  recipientStatus: {
    created: "created",
    sent: "sent",
    delivered: "delivered",
    signed: "signed",
    declined: "declined"
  }
};

export default docusignConfig;
