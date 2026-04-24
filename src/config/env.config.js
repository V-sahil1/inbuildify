import "dotenv/config";

const PROCESSENV = process.env;

function getEnvValue(name) {
  const value = PROCESSENV[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: (PROCESSENV.NODE_ENV) || "development",
  PORT: getEnvValue("PORT"),
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PROCESSENV.PORT || 5000}`,
  DB: {
    DB_NAME: getEnvValue("DB_NAME"),
    DB_PORT: getEnvValue("DB_PORT"),
    DB_USER: getEnvValue("DB_USER"),
    DB_PASSWORD: getEnvValue("DB_PASSWORD"),
    DB_HOST: getEnvValue("DB_HOST"),
    DATABASE_URL: PROCESSENV.DATABASE_URL || null,
  },

  JWT: {
    JWT_SECRET: getEnvValue("JWT_SECRET"),
    JWT_REFRESH_SECRET: getEnvValue("JWT_REFRESH_SECRET"),
    JWT_SECRET_EXPIRATION: getEnvValue("JWT_SECRET_EXPIRATION"),
    JWT_REFRESH_SECRET_EPXIRATION: getEnvValue("JWT_REFRESH_SECRET_EXPIRATION"),

  },

  EMAIL: {
    GMAIL: getEnvValue("GMAIL"),
    PASSWORD: getEnvValue("PASSWORD"),
    PASSWORD_SECRET: getEnvValue("JWT_REFRESH_SECRET_EXPIRATION"),
    FRONTEND_BASE_URL: getEnvValue("FRONTEND_BASE_URL"),
    BACKEND_BASE_URL: process.env.BACKEND_URL || process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
  },
  AWS: {
    AWS_ACCESS_KEY_ID: getEnvValue("AWS_ACCESS_KEY_ID"),
    AWS_SECRET_ACCESS_KEY: getEnvValue("AWS_SECRET_ACCESS_KEY"),
    AWS_REGION: getEnvValue("AWS_REGION"),
    S3_BUCKET_NAME: getEnvValue("S3_BUCKET_NAME"),
    FILE_TYPES: getEnvValue("FILE_TYPES"),
    FILE_SIZE: getEnvValue("FILE_SIZE"),
  },
  REDIS: {
    REDIS_HOST: getEnvValue("REDIS_HOST"),
    REDIS_PORT: getEnvValue("REDIS_PORT"),
    // REDIS_PASSWORD: getEnvValue("REDIS_PASSWORD"),
    ...(process.env.REDIS_PASSWORD
      ? { password: process.env.REDIS_PASSWORD }
      : {}),
  },
  QUOTATION_HASH_SECRET: process.env.QUOTATION_HASH_SECRET || "inbuildify-quotation-hash-key-2024",
  DOCUSIGN: {
    BASE_URL: process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi",
    OAUTH_BASE_PATH: process.env.DOCUSIGN_OAUTH_BASE_PATH || "account-d.docusign.com",
    CLIENT_ID: getEnvValue("DOCUSIGN_CLIENT_ID"),
    USER_ID: getEnvValue("DOCUSIGN_USER_ID"),
    RSA_KEY: getEnvValue("DOCUSIGN_RSA_KEY"),
    WEBHOOK_URL: process.env.DOCUSIGN_WEBHOOK_URL || "",
    WEBHOOK_SECRET: process.env.DOCUSIGN_WEBHOOK_SECRET || "",
    SIGNING_REDIRECT_URL: process.env.DOCUSIGN_SIGNING_REDIRECT_URL || "",
    EXPIRATION_DAYS: parseInt(process.env.DOCUSIGN_EXPIRATION_DAYS || "30"),
  },
};
