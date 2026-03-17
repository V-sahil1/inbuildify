import dotenv from "dotenv";

dotenv.config({ quiet: true });

const isSsl = process.env.NODE_ENV === "production";
const pgConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: isSsl ? { rejectUnauthorized: false, sslmode: "require" } : false,
  max: 10000,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 0,
  maxUses: 10000,
  waitForConnections: true,
  queueLimit: 0,
};

export default pgConfig;
