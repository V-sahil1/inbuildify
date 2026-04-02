// const express = require("express");
// const router = express.Router();
// const {
//   createProperty,
//   getPropertyByLeadId,
//   updateProperty,
//   getAllProperties,
//   deleteProperty,
// } = require("../controllers/property.controller");
// const { validateRequest } = require("../middleware/validateRequestMiddleware");
// const {
//   createPropertyParamSchema,
//   createPropertySchema,
//   getPropertyByLeadSchema,
//   updatePropertySchema,
//   updatePropertyParamSchema,
//   getAllPropertiesSchema,
//   deletePropertySchema,
// } = require("../validations/property.validation.js");
// const authMiddleware = require("../middleware/authMiddleware");
// const roleMiddleware = require("../middleware/roleMiddleware");
// const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
// const { REQUEST_SOURCE } = require("../config/constants");

// router.use(authMiddleware);
// router.use(roleMiddleware);
// router.use(camelToSnakeMiddleware);

// router.post(
//   "/:leads_id",
//   validateRequest(createPropertyParamSchema, REQUEST_SOURCE.PARAMS),
//   validateRequest(createPropertySchema),
//   createProperty
// );
// router.get("/", validateRequest(getAllPropertiesSchema, REQUEST_SOURCE.QUERY), getAllProperties);
// router.get("/:leads_id", validateRequest(getPropertyByLeadSchema, REQUEST_SOURCE.PARAMS), getPropertyByLeadId);
// router.put(
//   "/:property_detail_id",
//   validateRequest(updatePropertyParamSchema, REQUEST_SOURCE.PARAMS),
//   validateRequest(updatePropertySchema),
//   updateProperty
// );
// router.delete(
//   "/:property_detail_id",
//   validateRequest(deletePropertySchema, REQUEST_SOURCE.PARAMS),
//   deleteProperty
// );

// module.exports = router;
