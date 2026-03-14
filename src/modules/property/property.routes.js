const express = require("express");
const router = express.Router();
const {
  createProperty,
  getPropertyByLeadId,
  updateProperty,
  getAllProperties,
  deleteProperty,
} = require("./property.controller.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const {
  createPropertySchema,
  getPropertyByLeadSchema,
  updatePropertySchema,
  updatePropertyParamSchema,
  getAllPropertiesSchema,
  deletePropertySchema,
} = require("./property.validation.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post("/", validateRequest(createPropertySchema), createProperty);
router.get("/", validateRequest(getAllPropertiesSchema, REQUEST_SOURCE.QUERY), getAllProperties);
router.get("/:lead_id", validateRequest(getPropertyByLeadSchema, REQUEST_SOURCE.PARAMS), getPropertyByLeadId);
router.put(
  "/:property_id",
  validateRequest(updatePropertyParamSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePropertySchema),
  updateProperty
);
router.delete(
  "/:property_id",
  validateRequest(deletePropertySchema, REQUEST_SOURCE.PARAMS),
  deleteProperty
);

module.exports = router;
