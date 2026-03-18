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

  DB: {
    DB_NAME: getEnvValue("DB_NAME"),
    DB_PORT: getEnvValue("DB_PORT"),
    DB_USER: getEnvValue("DB_USER"),
    DB_PASSWORD: getEnvValue("DB_PASSWORD"),
    DB_HOST: getEnvValue("DB_HOST"),
  },

};
