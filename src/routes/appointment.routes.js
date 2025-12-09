const express = require("express");
const router = express.Router();

const {
  createAppointment,
  getAllAppointments,
  deleteAppointment,
  updateAppointment,
} = require("../controllers/appointment.controller");
const {
  createAppointmentSchema,
  getAllAppointmentSchema,
  deleteAppointmentSchema,
  updateAppointmentParamsSchema,
  updateAppointmentSchema,
} = require("../validations/appointment.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createAppointmentSchema, REQUEST_SOURCE.BODY),
  createAppointment
);

router.get(
  "/",
  validateRequest(getAllAppointmentSchema, REQUEST_SOURCE.QUERY),
  getAllAppointments
);

router.delete(
  "/:appointment_id",
  validateRequest(deleteAppointmentSchema, REQUEST_SOURCE.PARAMS),
  deleteAppointment
);

router.put(
  "/:appointment_id",
  validateRequest(updateAppointmentParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateAppointmentSchema, REQUEST_SOURCE.BODY),
  updateAppointment
);

module.exports = router;
