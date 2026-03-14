const express = require("express");
const router = express.Router();
const {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
} = require("./service.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const {
  createServiceSchema,
  getServiceByIdSchema,
  updateServiceParamsSchema,
  updateServiceSchema,
  deleteServiceSchema,
} = require("./service.validation.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createServiceSchema), createService);
router.get("/", getServices);
router.get("/:service_id", validateRequest(getServiceByIdSchema, REQUEST_SOURCE.PARAMS), getServiceById);
router.put("/:service_id", validateRequest(updateServiceParamsSchema, REQUEST_SOURCE.PARAMS), validateRequest(updateServiceSchema), updateService);
router.delete("/:service_id", validateRequest(deleteServiceSchema, REQUEST_SOURCE.PARAMS), deleteService);

module.exports = router;
