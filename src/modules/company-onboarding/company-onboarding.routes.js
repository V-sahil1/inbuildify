import express from "express";

import {
  completeCompanyOnboarding,
} from "./company-onboarding.controller.js";
import {
  companyOnboardingParamsSchema,
  companyOnboardingBodySchema,
} from "./company-onboarding.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { createUpload, handleMulterError } from "../../utils/s3Upload.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("company");

// Phase 3 — onboarding details (logo, founder name, etc.) + flip flag to true.
router.patch(
  "/:id",
  upload.fields([
    { name: "companyLogo", maxCount: 1 },
    { name: "emailSignatureLogo", maxCount: 1 },
  ]),
  handleMulterError,
  (req, res, next) => {
    if (!req.body.address) {
      const address = {};
      for (const key in req.body) {
        const match = key.match(/^address\[(\w+)\]$/);
        if (match) {
          address[match[1]] = req.body[key];
          delete req.body[key];
        }
      }
      if (Object.keys(address).length > 0) req.body.address = address;
    }
    if (typeof req.body.address === "string") {
      try {
        req.body.address = JSON.parse(req.body.address);
      } catch {
        return res.status(400).json({ message: "Invalid address format" });
      }
    }
    next();
  },
  camelToSnakeMiddleware,
  validateRequest(companyOnboardingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(companyOnboardingBodySchema, REQUEST_SOURCE.FORM_DATA),
  completeCompanyOnboarding,
);

export default router;
