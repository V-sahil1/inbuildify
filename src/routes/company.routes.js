const express = require("express");
const router = express.Router();

const {
  getCompany,
  upsertCompany,
} = require("../controllers/company.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { upsertCompanySchema } = require("../validations/company.validation");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

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
  camelToSnakeMiddleware,
  validateRequest(upsertCompanySchema, REQUEST_SOURCE.FORM_DATA),
  upsertCompany
);

module.exports = router;
