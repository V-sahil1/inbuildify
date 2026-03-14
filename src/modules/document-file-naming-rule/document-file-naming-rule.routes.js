const express = require("express");
const router = express.Router();

const {
  createDocumentFileNamingRule,
  getAllDocumentFileNamingRules,
  deleteDocumentFileNamingRule,
  updateDocumentFileNamingRule,
  getNamingFormat,
  createNamingFormat,
} = require("./document-file-naming-rule.controller.js");
const {
  createDocumentFileNamingRuleSchema,
  getAllDocumentFileNamingRulesSchema,
  deleteDocumentFileNamingRuleSchema,
  updateDocumentFileNamingRuleParamsSchema,
  updateDocumentFileNamingRuleSchema,
  updateNamingFormatSchema,
} = require("./document-file-naming-rule.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createDocumentFileNamingRuleSchema, REQUEST_SOURCE.BODY),
  createDocumentFileNamingRule
);

router.get(
  "/",
  validateRequest(getAllDocumentFileNamingRulesSchema, REQUEST_SOURCE.QUERY),
  getAllDocumentFileNamingRules
);

router.delete(
  "/:document_file_naming_rule_id",
  validateRequest(deleteDocumentFileNamingRuleSchema, REQUEST_SOURCE.PARAMS),
  deleteDocumentFileNamingRule
);

router.put(
  "/:document_file_naming_rule_id",
  validateRequest(
    updateDocumentFileNamingRuleParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateDocumentFileNamingRuleSchema, REQUEST_SOURCE.BODY),
  updateDocumentFileNamingRule
);

router.post(
  "/naming-format",
  validateRequest(updateNamingFormatSchema, REQUEST_SOURCE.BODY),
  createNamingFormat
);

router.get(
  "/naming-format",
  getNamingFormat
);

module.exports = router;
