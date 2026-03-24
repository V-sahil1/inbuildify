import { env } from "./env.config.js";

const isSsl = env.NODE_ENV === "production";
const pgConfig = {
  connectionString: env.DB.DATABASE_URL,
  ssl: isSsl ? { rejectUnauthorized: false, sslmode: "require" } : false,
  max: 10000,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 0,
  maxUses: 10000,
  waitForConnections: true,
  queueLimit: 0,
};

export default pgConfig;
