const express = require("express");
const router = express.Router();
const { 
    getAllWorkFlowProcess, 
    createWorkFlowProcess, 
    updateWorkFlowProcess, 
    deleteWorkFlowProcess, 
    displayOrderManage,
    getWorkflowProcessesByCategoryId,
    createWorkflowProcessTask,
    updateWorkflowProcessTask,
    deleteWorkflowProcessTask 
} = require("../controllers/workflow-process.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { 
    getAllWorkFlowProcessSchema, 
    createWorkFlowProcessSchema,
    updateWorkFlowProcessSchema,
    displayOrderManageSchema,
    deleteWorkFlowProcessSchema,
    getWorkflowProcessesByCategoryIdSchema,
    createWorkflowProcessTaskSchema,
    updateWorkflowProcessTaskSchema,
    deleteWorkflowProcessTaskSchema 
} = require("../validations/workflow-process.validation");
const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("workflow_process");

router.get("/", validateRequest(getAllWorkFlowProcessSchema, REQUEST_SOURCE.QUERY), getAllWorkFlowProcess)
router.post("/", validateRequest(createWorkFlowProcessSchema, REQUEST_SOURCE.BODY), createWorkFlowProcess);
router.put("/:id", validateRequest(updateWorkFlowProcessSchema, REQUEST_SOURCE.BODY), updateWorkFlowProcess);
router.put("/display/order", validateRequest(displayOrderManageSchema, REQUEST_SOURCE.BODY), displayOrderManage);
router.delete("/:id", validateRequest(deleteWorkFlowProcessSchema, REQUEST_SOURCE.PARAMS), deleteWorkFlowProcess);

router.get('/task/:workflow_process_id', validateRequest(getWorkflowProcessesByCategoryIdSchema, REQUEST_SOURCE.PARAMS), getWorkflowProcessesByCategoryId);
router.post('/task', upload.single("image"), handleMulterError, validateRequest(createWorkflowProcessTaskSchema, REQUEST_SOURCE.FORM_DATA), createWorkflowProcessTask);
router.put('/task/:workflow_process_task_id', upload.single("image"), handleMulterError, validateRequest(updateWorkflowProcessTaskSchema, REQUEST_SOURCE.FORM_DATA), updateWorkflowProcessTask);
router.delete('/task/:workflow_process_task_id', validateRequest(deleteWorkflowProcessTaskSchema, REQUEST_SOURCE.PARAMS), deleteWorkflowProcessTask);

module.exports = router;
