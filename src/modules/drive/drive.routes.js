const express = require("express");
const router = express.Router();

const driveController = require("./drive.controller.js");
const { createDriveSchema, updateIdParamsSchema, updateDriveSchema, getAllDriveSchema} = require("./drive.validation.js");


const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post("/", validateRequest(createDriveSchema, REQUEST_SOURCE.BODY), driveController.createDrive);

router.get("/", validateRequest(getAllDriveSchema, REQUEST_SOURCE.QUERY), driveController.getDrives);

router.get("/:drive_id", driveController.getDriveById);

router.put("/:drive_id", validateRequest(updateIdParamsSchema, REQUEST_SOURCE.PARAMS), validateRequest(updateDriveSchema, REQUEST_SOURCE.BODY), driveController.updateDrive);

router.delete("/:drive_id",validateRequest(updateIdParamsSchema, REQUEST_SOURCE.PARAMS), driveController.deleteDrive);

module.exports = router;