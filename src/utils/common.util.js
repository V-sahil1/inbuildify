module.exports.generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports.checkRequiredFields = (body, requiredFields) => {
  return requiredFields.every((field) => body[field] !== undefined);
};

module.exports.keysToCamel = (obj) => {
  if (!obj) return null;
  const toCamel = (s) =>
    s.replace(/([-_][a-z])/g, (group) =>
      group.toUpperCase().replace("-", "").replace("_", "")
    );

  return Object.keys(obj).reduce((acc, key) => {
    acc[toCamel(key)] = obj[key];
    return acc;
  }, {});
};

module.exports.keysToCamelCase = (rows) => rows.map((r) => module.exports.keysToCamel(r));
