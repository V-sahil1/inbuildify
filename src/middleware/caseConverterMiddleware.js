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
    // Body: keep the existing validation logic
    if (req.body && typeof req.body === "object") {
      req.body = convertKeysToSnakeCase(req.body);
    }

    // Query: convert all keys to snake_case but do NOT reject snake_case
    if (req.query && typeof req.query === "object") {
      req.query = Object.keys(req.query).reduce((acc, key) => {
        const snakeKey = camelToSnake(key);
        acc[snakeKey] = req.query[key];
        return acc;
      }, {});
    }

    // Params: just convert keys to snake_case without rejecting
    if (req.params && typeof req.params === "object") {
      req.params = Object.keys(req.params).reduce((acc, key) => {
        const snakeKey = camelToSnake(key);
        acc[snakeKey] = req.params[key];
        return acc;
      }, {});
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
