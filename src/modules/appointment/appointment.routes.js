const express = require("express");
const router = express.Router();

const {
  createAppointment,
  getAllAppointments,
  deleteAppointment,
  updateAppointment,
  searchUserBuilderTables,
} = require("./appointment.controller.js");
const {
  createAppointmentSchema,
  getAllAppointmentSchema,
  deleteAppointmentSchema,
  updateAppointmentParamsSchema,
  updateAppointmentSchema,
} = require("./appointment.validation.js");

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
  validateRequest(createAppointmentSchema, REQUEST_SOURCE.BODY),
  createAppointment,
);
router.get(
  "/",
  validateRequest(getAllAppointmentSchema, REQUEST_SOURCE.QUERY),
  getAllAppointments,
);

router.get("/search", searchUserBuilderTables);

router.delete(
  "/:appointment_id",
  validateRequest(deleteAppointmentSchema, REQUEST_SOURCE.PARAMS),
  deleteAppointment,
);

router.put(
  "/:appointment_id",
  validateRequest(updateAppointmentParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateAppointmentSchema, REQUEST_SOURCE.BODY),
  updateAppointment,
);

module.exports = router;
