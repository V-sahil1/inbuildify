const userService = require("../services/user.service");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

module.exports.getUsers = async (req, res) => {
  try {
    const data = await userService.getUsers(req.user, req.query);
    return successResponse(
      res,
      keysToCamelCase(data),
      "Users fetched successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.getProfile = async (req, res) => {
  try {
    const data = await userService.getProfile(req.user.user_id);
    return successResponse(
      res,
      keysToCamelCase(data),
      "Profile fetched successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.createUser = async (req, res) => {
  try {
    const photo = req.files?.photo?.[0] || null;
    const signature = req.files?.signature?.[0] || null;

    const data = await userService.createUser(req.user, req.body, {
      photo,
      signature,
    });

    return successResponse(
      res,
      keysToCamelCase(data),
      "User created successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.user_id;

    const photo = req.files?.photo?.[0] || null;
    const signature = req.files?.signature?.[0] || null;

    const data = await userService.updateUser(req.user, userId, req.body, {
      photo,
      signature,
    });

    return successResponse(
      res,
      keysToCamelCase(data),
      "User updated successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.deleteUser = async (req, res) => {
  try {
    const data = await userService.deleteUser(req.user, req.params.user_id);
    return successResponse(
      res,
      keysToCamelCase(data),
      "User deleted (soft delete) successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

/* =========================================
    PASSWORD & LOGIN ID MANAGEMENT
========================================= */

module.exports.resetPassword = async (req, res) => {
  try {
    const data = await userService.resetPassword(
      req.user,
      req.params.user_id,
      req.body,
    );
    return successResponse(
      res,
      keysToCamelCase(data),
      "Password reset successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.changeLoginId = async (req, res) => {
  try {
    const data = await userService.changeLoginId(
      req.user,
      req.params.user_id,
      req.body,
    );
    return successResponse(
      res,
      keysToCamelCase(data),
      "Login ID changed successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

/* =========================================
       ACTIVE / INACTIVE MANAGEMENT
========================================= */

module.exports.toggleActive = async (req, res) => {
  try {
    const data = await userService.toggleActive(req.params.user_id);
    return successResponse(
      res,
      keysToCamelCase(data),
      "User active status updated.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

/* =========================================
           LOCK / UNLOCK USER
========================================= */

module.exports.toggleLock = async (req, res) => {
  try {
    const data = await userService.toggleLock(req.params.user_id);
    return successResponse(
      res,
      keysToCamelCase(data),
      "User lock status updated.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

/* =========================================
            PHOTO MANAGEMENT
========================================= */

module.exports.updatePhoto = async (req, res) => {
  try {
    const file = req.files?.photo?.[0] || null;
    if (!file) {
      return errorResponse(res, 400, "Photo file is required.");
    }

    const data = await userService.updatePhoto(
      req.user,
      req.params.user_id,
      file,
    );
    return successResponse(
      res,
      keysToCamelCase(data),
      "Photo updated successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.deletePhoto = async (req, res) => {
  try {
    const data = await userService.deletePhoto(req.user, req.params.user_id);
    return successResponse(
      res,
      keysToCamelCase(data),
      "Photo deleted successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

/* =========================================
          SIGNATURE MANAGEMENT
========================================= */

module.exports.updateSignature = async (req, res) => {
  try {
    const file = req.files?.signature?.[0] || null;
    if (!file) {
      return errorResponse(res, 400, "Signature file is required.");
    }

    const data = await userService.updateSignature(
      req.user,
      req.params.user_id,
      file,
    );
    return successResponse(
      res,
      keysToCamelCase(data),
      "Signature updated successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.deleteSignature = async (req, res) => {
  try {
    const data = await userService.deleteSignature(
      req.user,
      req.params.user_id,
    );
    return successResponse(
      res,
      keysToCamelCase(data),
      "Signature deleted successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};
