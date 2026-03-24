import express from "express";

const router = express.Router();
import { createAction, getAction, updateAction } from "./actions.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { createActionSchema, getActionSchema, updateActionSchema } from "./actions.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import { handleMulterError, createUpload } from "../../utils/s3Upload.js";

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("action");

router.post("/:lead_id", upload.single("attachment"), handleMulterError, validateRequest(createActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(createActionSchema.body, REQUEST_SOURCE.BODY), createAction);
router.put("/:action_id", upload.single("attachment"), handleMulterError, validateRequest(updateActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateActionSchema.body, REQUEST_SOURCE.BODY), updateAction);
router.get("/:lead_id", validateRequest(getActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(getActionSchema.query, REQUEST_SOURCE.QUERY), getAction);

export default router;
