const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");

const { createUpload, handleMulterError } = require("../utils/s3Upload");
const camelToSnake = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");

const {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  changeLoginIdSchema,
  getUsersSchema,
} = require("../validations/user.validation");

const { REQUEST_SOURCE } = require("../config/constants");

const uploadPhoto = createUpload("users/photo");
const uploadSignature = createUpload("users/signature");

/**
 * ================================
 *         USER ROUTES
 * ================================
 */

// GET all users (admin-only)
router.get(
  "/",
  camelToSnake,
  authMiddleware,
  roleMiddleware,
  validateRequest(getUsersSchema, REQUEST_SOURCE.QUERY),
  userController.getUsers,
);

router.get("/profile", camelToSnake, authMiddleware, userController.getProfile);

router.post(
  "/",
  uploadPhoto.fields([
    { name: "photo", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  handleMulterError,
  (req, res, next) => {
    if (req.body.address && typeof req.body.address === "string") {
      try {
        req.body.address = JSON.parse(req.body.address);
      } catch (error) {
        return res.status(400).json({ message: "Invalid address format" });
      }
    }
    next();
  },
  camelToSnake,
  authMiddleware,
  roleMiddleware,
  validateRequest(createUserSchema, REQUEST_SOURCE.FORM_DATA),
  userController.createUser,
);

router.put(
  "/:user_id",
  uploadPhoto.fields([
    { name: "photo", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  handleMulterError,
  (req, res, next) => {
    // Parse address if it's a string in form data
    if (req.body.address && typeof req.body.address === "string") {
      try {
        req.body.address = JSON.parse(req.body.address);
      } catch (error) {
        return res.status(400).json({ message: "Invalid address format" });
      }
    }
    next();
  },
  camelToSnake,
  authMiddleware,
  roleMiddleware,
  validateRequest(updateUserSchema, REQUEST_SOURCE.FORM_DATA),
  userController.updateUser,
);

// DELETE user (soft delete)
router.delete(
  "/:user_id",
  authMiddleware,
  roleMiddleware,
  userController.deleteUser,
);

/**
 * ================================
 *  PASSWORD & LOGIN ID MANAGEMENT
 * ================================
 */

// RESET PASSWORD (admin popup)
router.post(
  "/:userId/reset-password",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(resetPasswordSchema),
  userController.resetPassword,
);

// CHANGE LOGIN ID (admin popup)
router.post(
  "/:userId/change-login-id",
  camelToSnake,
  authMiddleware,
  roleMiddleware,
  validateRequest(changeLoginIdSchema),
  userController.changeLoginId,
);

/**
 * ================================
 *     ACCOUNT STATUS MANAGEMENT
 * ================================
 */

// Activate / Deactivate user
router.post(
  "/:userId/is-active",
  authMiddleware,
  roleMiddleware,
  userController.toggleActive,
);

// Lock / Unlock user
router.post(
  "/:userId/toggle-lock",
  authMiddleware,
  roleMiddleware,
  userController.toggleLock,
);

/**
 * ================================
 *     FILE MANAGEMENT (S3)
 * ================================
 */

// Upload photo only
router.post(
  "/:userId/photo",
  uploadPhoto.single("photo"),
  handleMulterError,
  authMiddleware,
  roleMiddleware,
  userController.updatePhoto,
);

// Upload signature only
router.post(
  "/:userId/signature",
  uploadSignature.single("signature"),
  handleMulterError,
  authMiddleware,
  roleMiddleware,
  userController.updateSignature,
);

// Delete photo
router.delete(
  "/:userId/photo",
  authMiddleware,
  roleMiddleware,
  userController.deletePhoto,
);

// Delete signature
router.delete(
  "/:userId/signature",
  authMiddleware,
  roleMiddleware,
  userController.deleteSignature,
);

module.exports = router;
