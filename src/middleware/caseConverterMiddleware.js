const camelToSnake = (str) =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const isObject = (obj) =>
  obj !== null && typeof obj === "object" && !Array.isArray(obj);

const isSnakeCaseKey = (key) => {
  return /^[a-z0-9_]+$/.test(key) && key.includes("_");
};

const convertKeysToSnakeCase = (data, res) => {
  if (Array.isArray(data)) {
    return data.map((item) => convertKeysToSnakeCase(item, res));
  }

  if (isObject(data)) {
    return Object.keys(data).reduce((acc, key) => {
      // 🚨 Reject snake_case keys
      if (isSnakeCaseKey(key)) {
        throw new Error(
          `Invalid field ${key}. Use camelCase keys instead of snake_case.`
        );
      }

      const snakeKey = camelToSnake(key);
      acc[snakeKey] = convertKeysToSnakeCase(data[key], res);
      return acc;
    }, {});
  }

  return data;
};

const camelToSnakeMiddleware = (req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      console.log(req.body), (req.body = convertKeysToSnakeCase(req.body));
    }

    if (req.query && typeof req.query === "object") {
      req.query = convertKeysToSnakeCase(req.query);
    }

    if (req.params && typeof req.params === "object") {
      req.params = convertKeysToSnakeCase(req.params);
    }

    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = camelToSnakeMiddleware;
