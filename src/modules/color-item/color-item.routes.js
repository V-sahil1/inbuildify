const express = require("express");
const router = express.Router();

const {
  createColorItem,
  getAllColorItems,
  getColorItemById,
  updateColorItem,
  deleteColorItem,
  deleteImageField,
  colorItemMove,
  copyColorItem,
  getColorItemsWithoutCategory,
} = require("./color-item.controller.js");
const {
  createColorItemSchema,
  getAllColorItemsSchema,
  getColorItemsWithoutCategorySchema,
  getColorItemByIdSchema,
  updateColorItemSchema,
  deleteColorItemSchema,
  deleteImageFieldSchema,
  colorItemMoveSchema,
  copyColorItemSchema,
} = require("./color-item.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const {
  createUpload,
  createImageOrPdfUpload,
  handleMulterError,
} = require("../../utils/s3Upload.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

const upload = createUpload("color-item");
const uploadImgOrPdf = createImageOrPdfUpload("color-item");

router.post(
  "/",
  uploadImgOrPdf.fields([
    { name: "specification", maxCount: 10 },
    { name: "colorImage", maxCount: 10 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createColorItemSchema, REQUEST_SOURCE.FORM_DATA),
  createColorItem,
);

router.get(
  "/",
  validateRequest(getAllColorItemsSchema, REQUEST_SOURCE.QUERY),
  getAllColorItems,
);

// Get color items without category
router.get(
  "/without-category",
  authMiddleware,
  roleMiddleware,
  validateRequest(getColorItemsWithoutCategorySchema, REQUEST_SOURCE.QUERY),
  getColorItemsWithoutCategory,
);

router.get(
  "/:color_item_id",
  camelToSnakeMiddleware,
  validateRequest(getColorItemByIdSchema, REQUEST_SOURCE.PARAMS),
  getColorItemById,
);

router.put(
  "/:color_item_id",
  upload.fields([
    { name: "specification", maxCount: 10 },
    { name: "colorImage", maxCount: 10 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(getColorItemByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateColorItemSchema, REQUEST_SOURCE.FORM_DATA),
  updateColorItem,
);

router.delete(
  "/:color_item_id",
  validateRequest(deleteColorItemSchema, REQUEST_SOURCE.PARAMS),
  deleteColorItem,
);

router.delete(
  "/image/:color_item_id",
  validateRequest(getColorItemByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(deleteImageFieldSchema, REQUEST_SOURCE.BODY),
  deleteImageField,
);

router.post(
  "/move/:color_item_id",
  validateRequest(getColorItemByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(colorItemMoveSchema, REQUEST_SOURCE.BODY),
  colorItemMove,
);

router.post(
  "/copy/:color_item_id",
  validateRequest(getColorItemByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(copyColorItemSchema, REQUEST_SOURCE.BODY),
  copyColorItem,
);

module.exports = router;
