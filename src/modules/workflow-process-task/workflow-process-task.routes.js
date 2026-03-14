const express = require("express");
const router = express.Router();
const {
    getAllWorkFlowProcessTask,
    deleteWorkFlowProcessTask,
} = require("./workflow-process-task.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const {
    getAllWorkFlowProcessTaskSchema,
    deleteWorkFlowProcessTaskSchema,
} = require("./workflow-process-task.validation");
const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllWorkFlowProcessTaskSchema, REQUEST_SOURCE.QUERY), getAllWorkFlowProcessTask);
router.delete("/:action_id", validateRequest(deleteWorkFlowProcessTaskSchema, REQUEST_SOURCE.PARAMS), deleteWorkFlowProcessTask);

module.exports = router;
