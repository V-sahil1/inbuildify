const errorResponse = require("../helper/response");
const { ERROR_MESSAGES, REQUIRED_ROLES } = require("../config/constants.js");
const isAuthorized = require("../helper/utils.js");

const roleMiddleware = async (req, res, next) => {
  const { user } = req;
  let accountRoles = user.role;

  if (!isAuthorized(accountRoles, REQUIRED_ROLES)) {
    return errorResponse(res, 403, ERROR_MESSAGES.FORBIDDEN);
  }

  return next();
};

module.exports = roleMiddleware;
