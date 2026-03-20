import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

import { Sequelize } from "sequelize";

import { env } from "../../../env.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log("🚀 ~ __dirname:", __dirname);

const DB_NAME = env.DB.DB_NAME;
const DB_PORT = parseInt(env.DB.DB_PORT);
const DB_USER = env.DB.DB_USER;
const DB_PASSWORD = env.DB.DB_PASSWORD;
const DB_HOST = env.DB.DB_HOST;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "postgres",
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const db = {
  sequelize,
  Sequelize,
};

export const initModels = async () => {
  const allFiles = fs.readdirSync(__dirname);

  const files = allFiles.filter((file) => file.endsWith(".model.js"));

  // STEP 1: Load and initialize ALL models first
  for (const file of files) {
    try {
      const fileUrl = pathToFileURL(path.join(__dirname, file)).href;
      const modelModule = await import(fileUrl);
      const modelFactory = modelModule.default;

      if (typeof modelFactory !== "function") {
        continue;
      }

      const model = modelFactory(sequelize);

      if (!model || !model.name) {
        continue;
      }

      db[model.name] = model;
    } catch (error) {
      console.error(error.stack); // ← full stack trace to find exact issue
    }
  }

  // STEP 2: Run associations AFTER all models are loaded
  Object.keys(db).forEach((modelName) => {
    if (modelName === "sequelize" || modelName === "Sequelize") return;
    const model = db[modelName];
    if (typeof model.associate === "function") {
      try {
        model.associate(db);
      } catch (error) {
        console.error(` Error associating ${modelName}:`, error.message);
      }
    }
  });

  console.log(`\n Total models registered: ${Object.keys(db).length - 2}`);
};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
