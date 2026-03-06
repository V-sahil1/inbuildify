const validationMessageFormatterHelper = require("../utils/validationMessageFormatterHelper");
const { UNPROCESSABLE_ENTITY, NOT_ACCEPTABLE } = require("../utils/errors");
const { REQUEST_SOURCE } = require("../config/constants");

module.exports.validateRequest =
  (schema, source = REQUEST_SOURCE.BODY) => {
    const middleware = (req, res, next) => {
      let dataToValidate;

      switch (source) {
        case REQUEST_SOURCE.BODY:
          dataToValidate = req.body;
          break;
        case REQUEST_SOURCE.QUERY:
          dataToValidate = req.query;
          break;
        case REQUEST_SOURCE.PARAMS:
          dataToValidate = req.params;
          break;
        case REQUEST_SOURCE.FORM_DATA:
          dataToValidate = { ...req.body };
          break;
        default:
          dataToValidate = req[source];
      }

      if (dataToValidate === undefined || dataToValidate === null) {
        return res.status(NOT_ACCEPTABLE.code).json({
          message: NOT_ACCEPTABLE.message,
          errors: ["Request payload is missing."],
        });
      }

      const { error } = schema.validate(dataToValidate, { abortEarly: false });

      if (error) {
        const validationError = validationMessageFormatterHelper(error.details);

        const validationErrorMessage = Object.keys(validationError)
          .map((key) => `${validationError[key]}`)
          .join(", ");

        return res.status(UNPROCESSABLE_ENTITY.code).json({
          message: validationErrorMessage,
          errors: UNPROCESSABLE_ENTITY.message,
        });
      }
      

      next();
    };

    // 🔹 Attach schema and source to middleware function
    middleware.joiSchema = schema;
    middleware.source = source; // "BODY", "QUERY", "PARAMS", etc.

    return middleware;
  };