const express = require("express");
const router = express.Router();

const {
  createContractFormat,
  getAllContractFormats,
  getContractFormatById,
  updateContractFormat,
  deleteContractFormat,
} = require("./contract-format.controller.js");
const {
  createContractFormatSchema,
  getAllContractFormatsSchema,
  getContractFormatByIdSchema,
  updateContractFormatParamsSchema,
  updateContractFormatSchema,
  deleteContractFormatSchema,
} = require("./contract-format.validation.js");

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
  validateRequest(createContractFormatSchema, REQUEST_SOURCE.BODY),
  createContractFormat,
);

router.get(
  "/",
  validateRequest(getAllContractFormatsSchema, REQUEST_SOURCE.QUERY),
  getAllContractFormats,
);

router.get(
  "/:contract_format_id",
  validateRequest(getContractFormatByIdSchema, REQUEST_SOURCE.PARAMS),
  getContractFormatById,
);

router.put(
  "/:contract_format_id",
  validateRequest(updateContractFormatParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateContractFormatSchema, REQUEST_SOURCE.BODY),
  updateContractFormat,
);

router.delete(
  "/:contract_format_id",
  validateRequest(deleteContractFormatSchema, REQUEST_SOURCE.PARAMS),
  deleteContractFormat,
);

module.exports = router;
