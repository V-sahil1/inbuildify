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
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      req.body = convertKeysToSnakeCase(req.body);
    }

    if (req.files) {
      /**
       * Normalize files into:
       * [
       *   { fieldname, location }
       * ]
       */
      const normalizedFiles = [];

      // multer.array() OR multer.single()
      if (Array.isArray(req.files)) {
        normalizedFiles.push(...req.files);
      }

      // multer.fields()
      else if (typeof req.files === "object") {
        Object.values(req.files).forEach((files) => {
          if (Array.isArray(files)) {
            normalizedFiles.push(...files);
          }
        });
      }

      // Map files into req.body
      normalizedFiles.forEach((file) => {
        const key = camelToSnake(file.fieldname);
        const value = file.location ?? null;

        // Do not overwrite valid body values
        if (
          req.body[key] === undefined ||
          req.body[key] === null ||
          req.body[key] === ""
        ) {
          req.body[key] = value;
        }
      });
    }

    if (req.query && typeof req.query === "object") {
      req.query = Object.keys(req.query).reduce((acc, key) => {
        acc[camelToSnake(key)] = req.query[key];
        return acc;
      }, {});
    }

    if (req.params && typeof req.params === "object") {
      req.params = Object.keys(req.params).reduce((acc, key) => {
        acc[camelToSnake(key)] = req.params[key];
        return acc;
      }, {});
    }

    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Invalid request payload",
    });
  }
};

module.exports = camelToSnakeMiddleware;
