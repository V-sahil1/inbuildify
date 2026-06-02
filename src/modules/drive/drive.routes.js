import { Router } from "express";
import * as driveController from "./drive.controller.js";
import * as shareController from "./drive-share.controller.js";
import * as versionController from "./drive-version.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import {
  createFolderSchema,
  renameFolderSchema,
  renameFileSchema,
  uploadFileSchema,
  moveFileSchema,
  moveFolderSchema,
  getFilesSchema,
} from "./drive.validation.js";
import { createShareSchema, updateShareSchema } from "./drive-share.validation.js";
import { canView, canEdit, canAdmin } from "./drive.permissions.js";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only standard images and documents are allowed."), false);
    }
  },
});

// -----------------------------------------------------------------
// Global Drive Queries (no entity-level permission needed)
// -----------------------------------------------------------------
router.get("/search",      authMiddleware, roleMiddleware, driveController.searchDrive);
router.get("/trash",       authMiddleware, roleMiddleware, driveController.getTrash);
router.delete("/trash/empty", authMiddleware, roleMiddleware, driveController.emptyTrash);
router.get("/starred",     authMiddleware, roleMiddleware, driveController.getStarred);
router.get("/recent",      authMiddleware, roleMiddleware, driveController.getRecentFiles);
router.get("/stats",       authMiddleware, roleMiddleware, driveController.getStorageStats);

// -----------------------------------------------------------------
// Sharing & Permissions (Stage B)
// -----------------------------------------------------------------
router.post("/share",                       authMiddleware, roleMiddleware, camelToSnakeMiddleware, validateRequest(createShareSchema, REQUEST_SOURCE.BODY), shareController.createShare);
router.put("/share/:id",                    authMiddleware, roleMiddleware, camelToSnakeMiddleware, validateRequest(updateShareSchema, REQUEST_SOURCE.BODY), shareController.updateShare);
router.delete("/share/:id",                 authMiddleware, roleMiddleware, shareController.deleteShare);
router.get("/shared-with-me",               authMiddleware, roleMiddleware, shareController.getSharedWithMe);
router.get("/:type(folders|files)/:id/shares", authMiddleware, roleMiddleware, shareController.getEntityShares);

// -----------------------------------------------------------------
// Folder Routes — permission guards applied to mutating operations
// -----------------------------------------------------------------
router.get("/folders",               authMiddleware, roleMiddleware, driveController.getRootFolders);
router.post("/folders",              authMiddleware, roleMiddleware, camelToSnakeMiddleware, validateRequest(createFolderSchema, REQUEST_SOURCE.BODY), driveController.createFolder);
router.get("/folders/:id",           authMiddleware, roleMiddleware, canView, driveController.getFolderContents);
router.get("/folders/:id/breadcrumbs", authMiddleware, roleMiddleware, canView, driveController.getFolderBreadcrumbs);
router.put("/folders/:id",           authMiddleware, roleMiddleware, canEdit, camelToSnakeMiddleware, validateRequest(renameFolderSchema, REQUEST_SOURCE.BODY), driveController.renameFolder);
router.delete("/folders/:id",        authMiddleware, roleMiddleware, canAdmin, driveController.deleteFolder);
router.put("/folders/:id/move",      authMiddleware, roleMiddleware, canEdit, camelToSnakeMiddleware, validateRequest(moveFolderSchema, REQUEST_SOURCE.BODY), driveController.moveFolder);
router.put("/folders/:id/restore",   authMiddleware, roleMiddleware, driveController.restoreFolder);
router.put("/folders/:id/star",      authMiddleware, roleMiddleware, canView, driveController.toggleStarFolder);

// -----------------------------------------------------------------
// File Routes — permission guards applied to mutating operations
// -----------------------------------------------------------------
router.post("/files/upload",         authMiddleware, roleMiddleware, upload.single("file"), camelToSnakeMiddleware, validateRequest(uploadFileSchema, REQUEST_SOURCE.BODY), driveController.uploadFile);
router.get("/files",                 authMiddleware, roleMiddleware, camelToSnakeMiddleware, validateRequest(getFilesSchema, REQUEST_SOURCE.QUERY), driveController.getFilesInFolder);
router.put("/files/:id",             authMiddleware, roleMiddleware, canEdit, camelToSnakeMiddleware, validateRequest(renameFileSchema, REQUEST_SOURCE.BODY), driveController.renameFile);
router.delete("/files/:id",          authMiddleware, roleMiddleware, canAdmin, driveController.deleteFile);
router.get("/files/:id/download",    authMiddleware, roleMiddleware, canView, driveController.downloadFile);
router.put("/files/:id/move",        authMiddleware, roleMiddleware, canEdit, camelToSnakeMiddleware, validateRequest(moveFileSchema, REQUEST_SOURCE.BODY), driveController.moveFile);
router.put("/files/:id/restore",     authMiddleware, roleMiddleware, driveController.restoreFile);
router.put("/files/:id/star",        authMiddleware, roleMiddleware, canView, driveController.toggleStarFile);

// -----------------------------------------------------------------
// File Version Routes (Stage C1)
// -----------------------------------------------------------------
router.post("/files/:id/versions",                    authMiddleware, roleMiddleware, canEdit, upload.single("file"), versionController.uploadNewVersion);
router.get("/files/:id/versions",                     authMiddleware, roleMiddleware, canView, versionController.getFileVersions);
router.get("/files/:id/versions/:versionId/download", authMiddleware, roleMiddleware, canView, versionController.getVersionDownloadUrl);
router.put("/files/:id/versions/:versionId/restore",  authMiddleware, roleMiddleware, canEdit, versionController.restoreVersion);
router.delete("/files/:id/versions/:versionId",       authMiddleware, roleMiddleware, canAdmin, versionController.deleteVersion);

// -----------------------------------------------------------------
// Reorder Route (Stage C2) — parent-folder scoped
// -----------------------------------------------------------------
router.put("/reorder", authMiddleware, roleMiddleware, camelToSnakeMiddleware, driveController.reorderItems);

// -----------------------------------------------------------------
// Thumbnail Route (Stage C3)
// -----------------------------------------------------------------
router.get("/files/:id/thumbnail", authMiddleware, roleMiddleware, canView, driveController.getFileThumbnail);

export default router;
