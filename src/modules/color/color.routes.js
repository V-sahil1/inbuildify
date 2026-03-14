const express = require("express");
const router = express.Router();

const {
  createColor,
  getColors,
  getColorById,
  updateColor,
  deleteColor,
  copyColor,
} = require("./color.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../../config/constants");
const {
  createColorSchema,
  updateColorSchema,
  copyColorSchema,
} = require("./color.validation");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorSchema, REQUEST_SOURCE.BODY),
  createColor,
);

router.get("/", getColors);

router.get("/:id", getColorById);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(updateColorSchema, REQUEST_SOURCE.BODY),
  updateColor,
);

router.delete("/:id", deleteColor);

router.post(
  "/copy/:color_id",
  camelToSnakeMiddleware,
  validateRequest(copyColorSchema, REQUEST_SOURCE.BODY),
  copyColor,
);

module.exports = router;
