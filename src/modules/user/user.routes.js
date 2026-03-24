import express from "express";

const router = express.Router();

import userController from "./user.controller.js";
import { createUpload, handleMulterError } from "../../utils/s3Upload.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  changeLoginIdSchema,
  getUsersSchema,
} from "./user.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

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
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(getUsersSchema, REQUEST_SOURCE.QUERY),
  userController.getUsers,
);

router.get("/profile", camelToSnakeMiddleware, authMiddleware, userController.getProfile);

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
  camelToSnakeMiddleware,
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
  camelToSnakeMiddleware,
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
  camelToSnakeMiddleware,
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

export default router;
