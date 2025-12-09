const express = require("express");
const router = express.Router();

const {
  createConstructionOption,
  getAllConstructionOptions,
  deleteConstructionOption,
  updateConstructionOption,
} = require("../controllers/construction-option.controller");
const {
  createConstructionOptionSchema,
  getAllConstructionOptionSchema,
  deleteConstructionOptionSchema,
  updateConstructionOptionParamsSchema,
  updateConstructionOptionSchema,
} = require("../validations/construction-option.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createConstructionOptionSchema, REQUEST_SOURCE.BODY),
  createConstructionOption
);

router.get(
  "/",
  validateRequest(getAllConstructionOptionSchema, REQUEST_SOURCE.QUERY),
  getAllConstructionOptions
);

router.delete(
  "/:id",
  validateRequest(deleteConstructionOptionSchema, REQUEST_SOURCE.PARAMS),
  deleteConstructionOption
);

router.put(
  "/:id",
  validateRequest(updateConstructionOptionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionOptionSchema, REQUEST_SOURCE.BODY),
  updateConstructionOption
);

module.exports = router;
