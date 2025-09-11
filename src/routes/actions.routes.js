const express = require("express");
const router = express.Router();
const {
  createAction,
  getAction,
} = require("../controllers/actions.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createActionSchema,
  getActionSchema,
} = require("../validations/actions.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");
const { handleMulterError } = require("../utils/s3Upload.js");
const { createUpload } = require("../utils/s3Upload.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("action");

router.post("/:lead_id", upload.single("attachment"), handleMulterError, validateRequest(createActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(createActionSchema.body, REQUEST_SOURCE.BODY), createAction);
router.get("/:lead_id", validateRequest(getActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(getActionSchema.query, REQUEST_SOURCE.QUERY), getAction);
  

module.exports = router;
