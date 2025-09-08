const express = require("express");
const router = express.Router();
const { createJob } = require("../controllers/job.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createJobSchema } = require("../validations/job.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createJobSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(createJobSchema.body, REQUEST_SOURCE.BODY), createJob);

module.exports = router;
