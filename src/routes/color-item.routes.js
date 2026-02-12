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
} = require("../controllers/color-item.controller");
const {
  createColorItemSchema,
  getAllColorItemsSchema,
  getColorItemByIdSchema,
  updateColorItemSchema,
  deleteColorItemSchema,
  deleteImageFieldSchema,
  colorItemMoveSchema,
  copyColorItemSchema,
} = require("../validations/color-item.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const {
  createUpload,
  createImageOrPdfUpload,
  handleMulterError,
} = require("../utils/s3Upload");

const { REQUEST_SOURCE } = require("../config/constants");

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
