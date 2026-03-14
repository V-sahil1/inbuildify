const express = require("express");
const router = express.Router();

const {
  createClientType,
  getAllClientType,
  deleteClientType,
  updateClientType,
  updateClientTypeIsActive,
} = require("./client-type.controller.js");
const {
  createClientTypeSchema,
  getAllClientTypeSchema,
  deleteClientTypeSchema,
  updateClientTypeParamsSchema,
  updateClientTypeSchema,
  updateClientTypeIsActiveSchema,
} = require("./client-type.validation.js");

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
  validateRequest(createClientTypeSchema, REQUEST_SOURCE.BODY),
  createClientType
);

router.get(
  "/",
  validateRequest(getAllClientTypeSchema, REQUEST_SOURCE.QUERY),
  getAllClientType
);

router.delete(
  "/:id",
  validateRequest(deleteClientTypeSchema, REQUEST_SOURCE.PARAMS),
  deleteClientType
);

router.put(
  "/:id",
  validateRequest(updateClientTypeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateClientTypeSchema, REQUEST_SOURCE.BODY),
  updateClientType
);

router.put(
  "/is-active/:id",
  validateRequest(updateClientTypeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateClientTypeIsActiveSchema, REQUEST_SOURCE.BODY),
  updateClientTypeIsActive
);

module.exports = router;
