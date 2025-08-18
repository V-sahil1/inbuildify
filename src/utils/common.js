const { v4: uuidv4 } = require('uuid');

export const generateRequestId = () => {
  return uuidv4();
}

export const checkRequiredFields = (bodyFields, requiredFields) => {
  console.log("🚀 ~ common.js:2 ~ checkRequiredFields ~ bodyFields:", bodyFields);
  console.log("🚀 ~ common.js:2 ~ checkRequiredFields ~ requiredFields:", requiredFields);
  return requiredFields.every(field => bodyFields.includes(field));
};

export const checkValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
