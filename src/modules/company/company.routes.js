import express from "express";

const router = express.Router();

import { getCompany, upsertCompany } from "./company.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import { upsertCompanySchema } from "./company.validation";
import { createUpload, handleMulterError } from "../../utils/s3Upload";

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("company");

router.get("/", getCompany);

router.post(
  "/",
  upload.fields([
    { name: "emailSignatureLogo", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
  ]),
  handleMulterError,
  (req, res, next) => {
    // Parse address if it's a string in form data
    if (req.body.address && typeof req.body.address === "string") {
      try {
        req.body.address = JSON.parse(req.body.address);
      } catch (error) {
        return res.status(400).json({ message: "Invalid address format" });
      }
    }
    next();
  },
  camelToSnakeMiddleware,
  validateRequest(upsertCompanySchema, REQUEST_SOURCE.FORM_DATA),
  upsertCompany,
);

export default router;
