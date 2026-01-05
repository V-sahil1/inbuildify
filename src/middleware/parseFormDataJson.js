const parseFormDataJson = (req, res, next) => {
  const jsonFields = ["address", "insurer"];

  jsonFields.forEach((field) => {
    if (req.body[field] && typeof req.body[field] === "string") {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (err) {
        // leave as-is if not valid JSON
      }
    }
  });

  next();
};

module.exports = parseFormDataJson;
