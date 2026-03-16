/**
 * Master orchestrator — seeds all default settings for a new builder.
 * Called from registerRoot in auth.service.js within the same transaction.
 */

import { seedGeneralSettings } from "./seed-general-settings";
import { seedSalesModuleSettings } from "./seed-sales-module-settings";
import { seedQuotationSettings } from "./seed-quotation-settings";
import { seedHouseLandPackageSettings } from "./seed-house-land-package-settings";
import { seedJobSettings } from "./seed-job-settings";
import { seedJobColorSettings } from "./seed-job-color-settings";
import { seedJobWorkflowSettings } from "./seed-job-workflow-settings";
import { seedJobInvoiceSettings } from "./seed-job-invoice-settings";
import { seedJobVariationSettings } from "./seed-job-variation-settings";
import { seedJobCommissionSettings } from "./seed-job-commission-settings";
import { seedMaintenanceSettings } from "./seed-maintenance-settings";
import { seedConstructionSettings } from "./seed-construction-settings";
import { seedPasswordPolicy } from "./seed-password-policy";
import { seedPortalSettings } from "./seed-portal-settings";
import { seedIntegrationSettings } from "./seed-integration-settings";
import { seedTemplateEmailSignature } from "./seed-template-email-signature";
import { seedSchedulerSettings } from "./seed-scheduler-settings";
import { seedConstructionEtsRecharge } from "./seed-construction-ets-recharge";
import { seedConstructionOhsSettings } from "./seed-construction-ohs-settings";
import { seedRecalculateDate } from "./seed-recalculate-date";
import { seedDocumentFolderMapping } from "./seed-document-folder-mapping";
import { seedDocumentFileNamingFormat } from "./seed-document-file-naming-format";
import { seedTemplateEmail } from "./seed-template-email";
import { seedInitialPdfTemplates } from "./template-pdf.seed";

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

export default { seedBuilderDefaults };
