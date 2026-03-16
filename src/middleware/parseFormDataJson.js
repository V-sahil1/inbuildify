const parseFormDataJson = (req, res, next) => {
  const result = {};
  const regex = /^(\w+)\[(\w+)\]$/;

  for (const key in req.body) {
    const match = key.match(regex);

    if (match) {
      const parent = match[1];
      const child = match[2];

      if (!result[parent]) {
        result[parent] = {};
      }

      result[parent][child] = req.body[key];
    } else {
      result[key] = req.body[key];
    }
  }

  req.body = result;
  next();
};

export default parseFormDataJson;
