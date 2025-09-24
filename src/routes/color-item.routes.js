const express = require("express");
const router = express.Router();
const {
  getAllColorItems,
  getColorItemById,
  createColorItem,
  updateColorItem,
  deleteColorItem,
} = require("../controllers/color-item.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllColorItemsSchema,
  createColorItemSchema,
  updateColorItemSchema,
  colorItemIdParamSchema,
} = require("../validations/color-item.validation");
const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("color_item");

router.get("/", validateRequest(getAllColorItemsSchema, REQUEST_SOURCE.QUERY), getAllColorItems);
router.get("/:color_item_id", validateRequest(colorItemIdParamSchema, REQUEST_SOURCE.PARAMS), getColorItemById);
router.post("/", upload.single("image"), handleMulterError, validateRequest(createColorItemSchema, REQUEST_SOURCE.FORM_DATA), createColorItem);
router.put("/:color_item_id", upload.single("image"), handleMulterError, validateRequest(updateColorItemSchema, REQUEST_SOURCE.FORM_DATA), updateColorItem);
router.delete("/:color_item_id", validateRequest(colorItemIdParamSchema, REQUEST_SOURCE.PARAMS), deleteColorItem);

module.exports = router;
