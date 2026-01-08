const express = require("express");
const router = express.Router();

const {
  createTemplatePdf,
  updateTemplatePdf,
  getTemplatePdfById,
  getTemplatePdfList,
  deleteTemplatePdf,
} = require("../controllers/template-pdf.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

const {
  createTemplatePdfSchema,
} = require("../validations/template-pdf.validation");

const { createUpload, handleMulterError } = require("../utils/s3Upload");
const parseFormDataJson = require("../middleware/parseFormDataJson");

const upload = createUpload("pdf-template-assets");


router.use(authMiddleware);
router.use(roleMiddleware);

/** LIST */
router.get("/", getTemplatePdfList);

/** GET BY ID */
router.get("/:template_pdf_id", getTemplatePdfById);

/** CREATE */
router.post(
  "/",
  upload.fields([
    { name: "logoImage", maxCount: 1 },
    { name: "watermarkImage", maxCount: 1 },
  ]),
  handleMulterError,
  parseFormDataJson,
  camelToSnakeMiddleware,
  validateRequest(createTemplatePdfSchema, REQUEST_SOURCE.FORM_DATA),
  createTemplatePdf
);

/** UPDATE */
router.put(
  "/:template_pdf_id",
  upload.fields([
    { name: "logoImage", maxCount: 1 },
    { name: "watermarkImage", maxCount: 1 },
  ]),
  handleMulterError,
  parseFormDataJson,
  camelToSnakeMiddleware,
  updateTemplatePdf
);

/** DELETE */
router.delete("/:template_pdf_id", deleteTemplatePdf);

module.exports = router;
