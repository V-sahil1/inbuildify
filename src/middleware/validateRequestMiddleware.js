const validationMessageFormatterHelper = require('../utils/validationMessageFormatterHelper');
const { UNPROCESSABLE_ENTITY } = require('../utils/errors');
const { REQUEST_SOURCE } = require('../config/constants');

module.exports.validateRequest =
  (schema, source = REQUEST_SOURCE.BODY) =>
  (req, res, next) => {
    const { error } = schema.validate(req[source], {
      abortEarly: false,
    });
    if (error) {
      const validationError = validationMessageFormatterHelper(error.details);

      return res.status(UNPROCESSABLE_ENTITY.code).json({
        message: UNPROCESSABLE_ENTITY.message,
        errors: validationError,
      });
    }

    next();
  };
