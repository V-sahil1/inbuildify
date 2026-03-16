import express from "express";

const router = express.Router();

import {
  createTemplatePdf,
  updateTemplatePdf,
  getTemplatePdfById,
  getTemplatePdfList,
  deleteTemplatePdf,
} from "./template-pdf.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import { createTemplatePdfSchema } from "./template-pdf.validation";
import { createUpload, handleMulterError } from "../../utils/s3Upload";
import parseFormDataJson from "../../middleware/parseFormDataJson";

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
  createTemplatePdf,
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
  updateTemplatePdf,
);

/** DELETE */
router.delete("/:template_pdf_id", deleteTemplatePdf);

export default router;
