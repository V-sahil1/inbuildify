const express = require("express");
const router = express.Router();
const { createCompany } = require("../controllers/company.controller");
const { createCompanySchema } = require("../validations/company.validation");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("company");

router.post(
  "/",
  upload.fields([
    { name: "email_signature_logo", maxCount: 1 },
    { name: "company_logo", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createCompanySchema, REQUEST_SOURCE.FORM_DATA),
  createCompany
);

module.exports = router;
