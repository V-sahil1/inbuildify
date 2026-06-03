import { Sequelize } from "sequelize";
import { env } from "./env.config.js";

/**
 * Ensures the database specified by DB_NAME exists in PostgreSQL.
 * Connects to the default "postgres" database to check/create.
 *
 * @returns {{ created: boolean }} — true if the database was just created
 */
export async function ensureDatabase() {
  const dbName = env.DB.DB_NAME;

  const isProduction = env.NODE_ENV === "production";

  // Connect to the default "postgres" database to check/create the application database
  let connectionString;
  if (isProduction && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      url.pathname = "/postgres";
      connectionString = url.toString();
    } catch (e) {
      connectionString = `postgresql://${env.DB.DB_USER}:${env.DB.DB_PASSWORD}@${env.DB.DB_HOST}:${env.DB.DB_PORT}/postgres`;
    }
  } else {
    connectionString = `postgresql://${env.DB.DB_USER}:${env.DB.DB_PASSWORD}@${env.DB.DB_HOST}:${env.DB.DB_PORT}/postgres`;
  }

  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    dialectOptions: isProduction ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
  });

  try {
    await sequelize.authenticate();

    // Check if database exists
    const [results] = await sequelize.query(
      "SELECT 1 FROM pg_database WHERE datname = :dbName",
      {
        replacements: { dbName },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (!results) {
      // Database doesn't exist — create it
      // Note: CREATE DATABASE cannot run inside a transaction.
      await sequelize.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
      return { created: true };
    }

    console.log(`ℹ️  Database "${dbName}" already exists.`);
    return { created: false };
  } catch (error) {
    console.error(`❌ Error ensuring database "${dbName}":`, error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}
