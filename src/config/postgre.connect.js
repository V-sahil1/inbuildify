import db, { initModels } from "../config/database/models/postgre-models/index.js";
import { runPendingMigrations } from "../config/database/migrationRunner.js";
import { ensureDatabase } from "./db-bootstrap.js";
import { runDeveloperEssentialSeeds } from "../seeder/seedDeveloperEssentials.js";

export const connectPostgre = async () => {
  try {
    // Step 1: Ensure database exists (create if needed)
    const { created } = await ensureDatabase();

    // Step 2: Initialize Sequelize models
    await initModels();

    // Step 3: Authenticate, then sync models to the DB first.
    // This ensures tables exist before migrations run, as migrations often
    // use queryInterface.describeTable() which fails if the table is missing.
    await db.sequelize.authenticate();
    await db.sequelize.sync({ alter: true });
    await runPendingMigrations(db.sequelize);

    console.log("Database connected successfully");

    // Step 4: Auto-seed essentials if database was just created
    if (created) {
      console.log("🌱 New database detected — running essential seeds...");
      await runDeveloperEssentialSeeds();
    }

  } catch (error) {
    console.error("Database connection error:", error);
  }
};

export default db;