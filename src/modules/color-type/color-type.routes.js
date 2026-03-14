const express = require("express");
const router = express.Router();

const {
  createColorType,
  getAllColorTypes,
  getColorTypeById,
  updateColorType,
  deleteColorType,
} = require("./color-type.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../../config/constants");
const {
  createColorTypeSchema,
  updateColorTypeSchema,
  paramsIdSchema,
} = require("./color-type.validation");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorTypeSchema, REQUEST_SOURCE.BODY),
  createColorType,
);

router.get("/", getAllColorTypes);

router.get("/:id", getColorTypeById);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateColorTypeSchema, REQUEST_SOURCE.BODY),
  updateColorType,
);

router.delete("/:id", deleteColorType);

module.exports = router;
