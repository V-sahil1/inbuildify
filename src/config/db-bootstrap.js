import pg from "pg";
import { env } from "./env.config.js";

/**
 * Ensures the database specified by DB_NAME exists in PostgreSQL.
 * Connects to the default "postgres" database to check/create.
 *
 * @returns {{ created: boolean }} — true if the database was just created
 */
export async function ensureDatabase() {
  const dbName = env.DB.DB_NAME;

  // Connect to the default "postgres" database
  const client = new pg.Client({
    host: env.DB.DB_HOST,
    port: parseInt(env.DB.DB_PORT),
    user: env.DB.DB_USER,
    password: env.DB.DB_PASSWORD,
    database: "postgres",
  });

  try {
    await client.connect();

    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rowCount === 0) {
      // Database doesn't exist — create it
      // Note: CREATE DATABASE cannot run inside a transaction,
      // and pg.Client doesn't wrap in one by default, so this is fine.
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
      return { created: true };
    }

    console.log(`ℹ️  Database "${dbName}" already exists.`);
    return { created: false };
  } catch (error) {
    console.error(`❌ Error ensuring database "${dbName}":`, error.message);
    throw error;
  } finally {
    await client.end();
  }
}
