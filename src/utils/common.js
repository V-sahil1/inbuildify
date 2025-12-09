const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const {
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_SIZE,
} = require("../config/constants");

const generateRequestId = () => {
  return uuidv4();
};

const checkRequiredFields = (bodyFields, requiredFields) => {
  console.log(
    "🚀 ~ common.js:2 ~ checkRequiredFields ~ bodyFields:",
    bodyFields
  );
  console.log(
    "🚀 ~ common.js:2 ~ checkRequiredFields ~ requiredFields:",
    requiredFields
  );
  return requiredFields.every((field) => bodyFields.includes(field));
};

const checkValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: "1d" });
};

const decrypt = (encryptedText) => {
  if (encryptedText == null || encryptedText === "") {
    return "";
  }

  const buffer = Buffer.from(encryptedText, "base64");
  return buffer.toString("utf8");
};

const encrypt = (text) => {
  if (text == null || text === "") {
    return "";
  }

  const buffer = Buffer.from(text, "utf8");
  return buffer.toString("base64");
};

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function keysToSnakeCase(obj) {
  if (obj instanceof Date) {
    return obj.toISOString();
  } else if (Array.isArray(obj)) {
    return obj.map(keysToSnakeCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        toSnakeCase(key),
        keysToSnakeCase(value),
      ])
    );
  }
  return obj;
}

function keysToCamelCase(obj) {
  if (obj instanceof Date) {
    return obj.toISOString();
  } else if (Array.isArray(obj)) {
    return obj.map(keysToCamelCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        toCamelCase(key),
        keysToCamelCase(value),
      ])
    );
  }
  return obj;
}

function allowedFileData() {
  return {
    types: ALLOWED_FILE_TYPES,
    size: ALLOWED_FILE_SIZE,
  };
}

module.exports = {
  generateRequestId,
  checkRequiredFields,
  checkValidEmail,
  generateOtp,
  generateAccessToken,
  generateRefreshToken,
  decrypt,
  encrypt,
  keysToSnakeCase,
  keysToCamelCase,
  allowedFileData,
};
