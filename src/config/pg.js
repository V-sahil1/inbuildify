const dotenv = require("dotenv");
dotenv.config({ quiet: true });

const pgConfig = {
  connectionString: process.env.DATABASE_URL,
  // ssl: {
  //   rejectUnauthorized: false,
  // },
  max: 10000,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 0,
  maxUses: 10000,
  waitForConnections: true,
  queueLimit: 0
};

module.exports = pgConfig;
