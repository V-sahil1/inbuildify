import db, { initModels } from "../config/database/models/postgre-models/index.js";
import { seedRoles } from "./seedRoles.js";
import { seedCountriesAndStates } from "./seedCountriesAndStates.js";
import { seedTimezones } from "./seed-timezones.js";
import { seedScreensAndFunctionalities } from "./seed-screens-functionalities.js";
import { seedCustomFieldModules } from "./seed-custom-field-module.js";
import { seedComplianceTypes } from "./seed-compliance-type.js";
import { seedRoleTypes } from "./seed-role-type.js";
import { seedJobProcessStageFunctionalities } from "./seed-job-process-stage-functionality.js";
import { seedCategories } from "./seedCategories.js";
import { seedConditions } from "./seedConditions.js";
import { seedEmailTemplates } from "./seedEmailTemplates.js";

/**
 * Run `seedFn` only when its backing table is empty. Each essential seeder is
 * gated independently on the row count of its representative model, so startup
 * seeding becomes "auto-seed any table that is still empty" instead of an
 * all-or-nothing run. Re-running is a no-op once a table is populated.
 */
const seedIfEmpty = async (modelName, seedFn) => {
  const model = db[modelName];
  if (!model) {
    console.warn(`⚠️  Model "${modelName}" not registered — skipping its seeder.`);
    return;
  }

  const count = await model.count();
  if (count > 0) {
    console.log(`⏭️  ${modelName} already has ${count} row(s) — skipping seeder.`);
    return;
  }

  console.log(`🌱 ${modelName} is empty — running seeder...`);
  await seedFn();
};

/**
 * Core seeding logic — can be called from connectPostgre or run standalone.
 * Each seeder only runs when its table is empty. Does NOT call process.exit()
 * — caller is responsible for that.
 */
export const runDeveloperEssentialSeeds = async () => {
  console.log("🚀 Starting Developer Essentials Seeding...");

  // Models must be registered before we can count rows / run seeders.
  // initModels() is idempotent, so this is safe even when the caller already
  // initialized models.
  await initModels();

  // Order matters: role types depend on roles already existing.
  await seedIfEmpty("Role", seedRoles);
  await seedIfEmpty("RoleType", seedRoleTypes);
  await seedIfEmpty("Country", seedCountriesAndStates);
  await seedIfEmpty("Timezones", seedTimezones);
  await seedIfEmpty("Screen", seedScreensAndFunctionalities);
  await seedIfEmpty("CustomFieldModule", seedCustomFieldModules);
  await seedIfEmpty("ComplianceType", seedComplianceTypes);
  await seedIfEmpty("JobProcessStageFunctionality", seedJobProcessStageFunctionalities);
  await seedIfEmpty("AdminCategory", seedCategories);
  await seedIfEmpty("Conditions", seedConditions);
  await seedIfEmpty("EmailTemplates", seedEmailTemplates);

  console.log("🏁 All developer essentials seeded successfully.");
};

/**
 * Standalone entry point — initializes models, seeds, then exits.
 * Usage: node src/seeder/seedDeveloperEssentials.js
 */
const seedDeveloperEssentials = async () => {
  try {
    // Initialize Sequelize models (only needed when running standalone)
    await initModels();

    await runDeveloperEssentialSeeds();
  } catch (error) {
    console.error("❌ Seeding process failed:", error);
  } finally {
    // Close connection properly
    if (db.sequelize) {
      await db.sequelize.close();
    }
    process.exit(0);
  }
};

// Only run standalone when invoked directly
if (process.argv[1] && (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")))) {
  seedDeveloperEssentials();
}
