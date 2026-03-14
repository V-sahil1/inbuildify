const express = require("express");
const router = express.Router();

const {
  getCompany,
  upsertCompany,
} = require("./company.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../../config/constants");
const { upsertCompanySchema } = require("./company.validation");
const { createUpload, handleMulterError } = require("../../utils/s3Upload");

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

module.exports = router;
