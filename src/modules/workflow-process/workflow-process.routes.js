import express from "express";

const router = express.Router();

import {
  getAllWorkFlowProcess,
  createWorkFlowProcess,
  updateWorkFlowProcess,
  deleteWorkFlowProcess,
  displayOrderManage,
  getWorkflowProcessesByCategoryId,
  createWorkflowProcessTask,
  updateWorkflowProcessTask,
  deleteWorkflowProcessTask,
} from "./workflow-process.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import {
  getAllWorkFlowProcessSchema,
  createWorkFlowProcessSchema,
  updateWorkFlowProcessSchema,
  displayOrderManageSchema,
  deleteWorkFlowProcessSchema,
  getWorkflowProcessesByCategoryIdSchema,
  createWorkflowProcessTaskSchema,
  updateWorkflowProcessTaskSchema,
  deleteWorkflowProcessTaskSchema,
} from "./workflow-process.validation";
import { REQUEST_SOURCE } from "../../config/constants";
import { createUpload, handleMulterError } from "../../utils/s3Upload";

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("workflow_process");

router.get("/", validateRequest(getAllWorkFlowProcessSchema, REQUEST_SOURCE.QUERY), getAllWorkFlowProcess);
router.post("/", validateRequest(createWorkFlowProcessSchema, REQUEST_SOURCE.BODY), createWorkFlowProcess);
router.put("/:id", validateRequest(updateWorkFlowProcessSchema, REQUEST_SOURCE.BODY), updateWorkFlowProcess);
router.put("/display/order", validateRequest(displayOrderManageSchema, REQUEST_SOURCE.BODY), displayOrderManage);
router.delete("/:id", validateRequest(deleteWorkFlowProcessSchema, REQUEST_SOURCE.PARAMS), deleteWorkFlowProcess);

router.get("/task/:workflow_process_id", validateRequest(getWorkflowProcessesByCategoryIdSchema, REQUEST_SOURCE.PARAMS), getWorkflowProcessesByCategoryId);
router.post("/task", upload.single("image"), handleMulterError, validateRequest(createWorkflowProcessTaskSchema, REQUEST_SOURCE.FORM_DATA), createWorkflowProcessTask);
router.put("/task/:workflow_process_task_id", upload.single("image"), handleMulterError, validateRequest(updateWorkflowProcessTaskSchema, REQUEST_SOURCE.FORM_DATA), updateWorkflowProcessTask);
router.delete("/task/:workflow_process_task_id", validateRequest(deleteWorkflowProcessTaskSchema, REQUEST_SOURCE.PARAMS), deleteWorkflowProcessTask);

export default router;
