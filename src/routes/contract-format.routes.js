const express = require("express");
const router = express.Router();

const {
  createContractFormat,
  getAllContractFormats,
  getContractFormatById,
  updateContractFormat,
  deleteContractFormat,
} = require("../controllers/contract-format.controller");
const {
  createContractFormatSchema,
  getAllContractFormatsSchema,
  getContractFormatByIdSchema,
  updateContractFormatParamsSchema,
  updateContractFormatSchema,
  deleteContractFormatSchema,
} = require("../validations/contract-format.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
