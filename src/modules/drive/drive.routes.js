import express from "express";

const router = express.Router();

import driveController from "./drive.controller.js";
import {
  createDriveSchema,
  updateIdParamsSchema,
  updateDriveSchema,
  getAllDriveSchema,
} from "./drive.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post("/", validateRequest(createDriveSchema, REQUEST_SOURCE.BODY), driveController.createDrive);

router.get("/", validateRequest(getAllDriveSchema, REQUEST_SOURCE.QUERY), driveController.getDrives);

router.get("/:drive_id", driveController.getDriveById);

router.put("/:drive_id", validateRequest(updateIdParamsSchema, REQUEST_SOURCE.PARAMS), validateRequest(updateDriveSchema, REQUEST_SOURCE.BODY), driveController.updateDrive);

router.delete("/:drive_id", validateRequest(updateIdParamsSchema, REQUEST_SOURCE.PARAMS), driveController.deleteDrive);

export default router;
