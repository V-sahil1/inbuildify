
const errorResponse = require("../helper/response");
const { ERROR_MESSAGES, REQUIRED_ROLES } = require("../config/constants.js");
const isAuthorized = require("../helper/utils.js");

const roleMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    const { user } = req;
    let accountRoles = user.role;
    
    // If no specific roles provided, use default REQUIRED_ROLES from constants
    const rolesToCheck = allowedRoles.length > 0 ? allowedRoles : REQUIRED_ROLES;
    
    if (!isAuthorized(accountRoles, rolesToCheck)) {
      return errorResponse(res, 403, ERROR_MESSAGES.FORBIDDEN);
    }

    return next();
  };
};

module.exports = roleMiddleware;