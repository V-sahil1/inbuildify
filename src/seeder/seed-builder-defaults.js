/**
 * Master orchestrator — seeds all default settings for a new builder.
 * Called from registerRoot in auth.service.js within the same transaction.
 */

const { seedGeneralSettings } = require("./seed-general-settings");
const { seedSalesModuleSettings } = require("./seed-sales-module-settings");
const { seedQuotationSettings } = require("./seed-quotation-settings");
const { seedHouseLandPackageSettings } = require("./seed-house-land-package-settings");
const { seedJobSettings } = require("./seed-job-settings");
const { seedJobColorSettings } = require("./seed-job-color-settings");
const { seedJobWorkflowSettings } = require("./seed-job-workflow-settings");
const { seedJobInvoiceSettings } = require("./seed-job-invoice-settings");
const { seedJobVariationSettings } = require("./seed-job-variation-settings");
const { seedJobCommissionSettings } = require("./seed-job-commission-settings");
const { seedMaintenanceSettings } = require("./seed-maintenance-settings");
const { seedConstructionSettings } = require("./seed-construction-settings");
const { seedPasswordPolicy } = require("./seed-password-policy");
const { seedPortalSettings } = require("./seed-portal-settings");
const { seedIntegrationSettings } = require("./seed-integration-settings");
const { seedTemplateEmailSignature } = require("./seed-template-email-signature");
const { seedSchedulerSettings } = require("./seed-scheduler-settings");
const { seedConstructionEtsRecharge } = require("./seed-construction-ets-recharge");
const { seedConstructionOhsSettings } = require("./seed-construction-ohs-settings");
const { seedRecalculateDate } = require("./seed-recalculate-date");
const { seedDocumentFolderMapping } = require("./seed-document-folder-mapping");
const { seedDocumentFileNamingFormat } = require("./seed-document-file-naming-format");
const { seedTemplateEmail } = require("./seed-template-email");
const { seedInitialPdfTemplates } = require("./template-pdf.seed");

/**
 * Seeds all default settings for a newly registered builder.
 * Runs within the caller's transaction (uses the provided client).
 *
 * @param {Object} params
 * @param {string|null} params.company_id
 * @param {string} params.builder_id
 * @param {string} params.created_by - users_id of the root user
 * @param {Object} params.client - pg client (within a transaction)
 */
async function seedBuilderDefaults({ company_id, builder_id, created_by, client }) {
  const ctx = { company_id, builder_id, created_by, client };

  console.log("🌱 Seeding default settings for builder:", builder_id);

  // 1. General Settings
  await seedGeneralSettings(ctx);

  // 2. Sales Module Settings
  await seedSalesModuleSettings(ctx);

  // 3. Quotation Settings
  await seedQuotationSettings(ctx);

  // 4. House & Land Package Settings
  await seedHouseLandPackageSettings(ctx);

  // 5. Job Settings
  await seedJobSettings(ctx);

  // 6. Job Color Settings
  await seedJobColorSettings(ctx);

  // 7. Job Workflow Settings
  await seedJobWorkflowSettings(ctx);

  // 8. Job Invoice Settings
  await seedJobInvoiceSettings(ctx);

  // 9. Job Variation Settings
  await seedJobVariationSettings(ctx);

  // 10. Job Commission Settings
  await seedJobCommissionSettings(ctx);

  // 11. Maintenance Settings
  await seedMaintenanceSettings(ctx);

  // 12. Construction Settings
  await seedConstructionSettings(ctx);

  // 13. Password Policy
  await seedPasswordPolicy(ctx);

  // 14. Portal Settings
  await seedPortalSettings(ctx);

  // 15. Integration Settings
  await seedIntegrationSettings(ctx);

  // 16. Template Email Signature
  await seedTemplateEmailSignature(ctx);

  // 17. Scheduler Settings
  await seedSchedulerSettings(ctx);

  // 18. Construction ETS Recharge
  await seedConstructionEtsRecharge(ctx);

  // 19. Construction OHS Settings
  await seedConstructionOhsSettings(ctx);

  // 20. Recalculate Date
  await seedRecalculateDate(ctx);

  // 21. Document Folder Mapping
  await seedDocumentFolderMapping(ctx);

  // 19. Document File Naming Format
  await seedDocumentFileNamingFormat(ctx);

  // 20. Template Email
  await seedTemplateEmail(ctx);

  // 21. PDF Templates (existing seeder)
  await seedInitialPdfTemplates({ company_id, builder_id, created_by, client });

  console.log("✅ All default settings seeded for builder:", builder_id);
}

module.exports = { seedBuilderDefaults };
