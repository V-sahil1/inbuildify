const express = require("express");
const router = express.Router();

const {
  createDocumentFileNamingRule,
  getAllDocumentFileNamingRules,
  deleteDocumentFileNamingRule,
  updateDocumentFileNamingRule,
} = require("../controllers/document-file-naming-rule.controller");
const {
  createDocumentFileNamingRuleSchema,
  getAllDocumentFileNamingRulesSchema,
  deleteDocumentFileNamingRuleSchema,
  updateDocumentFileNamingRuleParamsSchema,
  updateDocumentFileNamingRuleSchema,
} = require("../validations/document-file-naming-rule.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");
const { route } = require("./document-common-subfolder.routes");

router.use(authMiddleware);
router.use(roleMiddleware);

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

module.exports = router;
