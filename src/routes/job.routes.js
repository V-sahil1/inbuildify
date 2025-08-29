const express = require("express");
const router = express.Router();
const { createJob, getJobById } = require("../controllers/job.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createJobSchema, getJobByIdSchema } = require("../validations/job.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createJobSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(createJobSchema.body, REQUEST_SOURCE.BODY), createJob);
router.get("/:job_id", validateRequest(getJobByIdSchema.params, REQUEST_SOURCE.PARAMS), getJobById);

module.exports = router;
