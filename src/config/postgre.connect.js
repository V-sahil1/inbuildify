import db, { initModels } from "../config/database/models/postgre-models/index.js";
import { runPendingMigrations } from "../config/database/migrationRunner.js";
import { ensureDatabase } from "./db-bootstrap.js";
import { runDeveloperEssentialSeeds } from "../seeder/seedDeveloperEssentials.js";

export const connectPostgre = async () => {
  try {
    // Step 1: Ensure database exists (create if needed)
    const { created } = await ensureDatabase();

    // Step 2: Initialize Sequelize models
    console.time("⏱️  Model Initialization");
    await initModels();
    console.timeEnd("⏱️  Model Initialization");

    // Step 3: Authenticate
    console.time("⏱️  Database Authentication");
    await db.sequelize.authenticate();
    console.timeEnd("⏱️  Database Authentication");

    // Safe & Fast Verification: Check for missing tables in one go
    console.time("⏱️  Database Verification");
    const existingTables = await db.sequelize.getQueryInterface().showAllTables();
    const modelNames = Object.keys(db).filter(key => !["sequelize", "Sequelize"].includes(key));
    
    // Check if any model's table is missing
    const missingTables = modelNames.filter(name => {
      const tableName = db[name].tableName;
      return !existingTables.includes(tableName);
    });

    if (missingTables.length > 0) {
      console.log(`⚠️  Detected ${missingTables.length} missing tables. Running sync...`);
      await db.sequelize.sync();
    } else {
      console.log("✅ All tables verified.");
    }
    console.timeEnd("⏱️  Database Verification");
    
    console.time("⏱️  Migrations");
    await runPendingMigrations(db.sequelize);
    console.timeEnd("⏱️  Migrations");


    // Step 4: Auto-seed essentials if database was just created
    if (created) {
      console.log("🌱 New database detected — running essential seeds...");
      console.time("⏱️  Seeding");
      await runDeveloperEssentialSeeds();
      console.timeEnd("⏱️  Seeding");
    }

  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

export default db;
