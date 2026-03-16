import express from "express";

const router = express.Router();
import { getAllWorkFlowProcessTask, deleteWorkFlowProcessTask } from "./workflow-process-task.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { getAllWorkFlowProcessTaskSchema, deleteWorkFlowProcessTaskSchema } from "./workflow-process-task.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllWorkFlowProcessTaskSchema, REQUEST_SOURCE.QUERY), getAllWorkFlowProcessTask);
router.delete("/:action_id", validateRequest(deleteWorkFlowProcessTaskSchema, REQUEST_SOURCE.PARAMS), deleteWorkFlowProcessTask);

export default router;
