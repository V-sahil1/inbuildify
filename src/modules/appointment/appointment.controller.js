import { successResponse, errorResponse } from "../../helper/response.js";
import appointmentService from "./appointment.service.js";

/**
 * Controller: Create Appointment
 */
export async function createAppointment(req, res) {
  try {
    const response = await appointmentService.createAppointment(req.user, req.body);
    return successResponse(res, response, "Appointment created successfully.");
  } catch (err) {
    console.error("Error creating appointment:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  }
}

/**
 * Controller: Get All Appointments
 */
export async function getAllAppointments(req, res) {
  try {
    const response = await appointmentService.getAllAppointments(req.user, req.query);
    return successResponse(res, response);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  }
}

/**
 * Controller: Get Appointment Tab Counts
 */
export async function getAppointmentTabCounts(req, res) {
  try {
    const response = await appointmentService.getAppointmentTabCounts(req.user, req.query);
    return successResponse(res, response);
  } catch (err) {
    console.error("Error fetching appointment tab counts:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  }
}

/**
 * Controller: Delete Appointment
 */
export async function deleteAppointment(req, res) {
  try {
    const response = await appointmentService.deleteAppointment(req.user, req.params.appointment_id);
    return successResponse(res, response, "Appointment deleted successfully.");
  } catch (err) {
    console.error("Error deleting appointment:", err);
    return errorResponse(res, err.status || 500, err.message || "Failed to delete appointment.");
  }
}

/**
 * Controller: Update Appointment
 */
export async function updateAppointment(req, res) {
  try {
    const response = await appointmentService.updateAppointment(req.user, req.params.appointment_id, req.body);
    return successResponse(res, response, "Appointment updated successfully.");
  } catch (err) {
    console.error("Error updating appointment:", err);
    return errorResponse(res, err.status || 500, err.message || "Failed to update appointment.");
  }
}

/**
 * Controller: Search User Builder Tables
 */
export async function searchUserBuilderTables(req, res) {
  try {
    const response = await appointmentService.searchUserBuilderTables(req.query);
    return successResponse(res, response, "User builder table existence checked successfully.");
  } catch (err) {
    console.error("Error searching user builder tables:", err);
    return errorResponse(res, err.status || 500, err.message || "Failed to search user builder tables.");
  }
}

export default {
  createAppointment,
  getAllAppointments,
  getAppointmentTabCounts,
  deleteAppointment,
  updateAppointment,
  searchUserBuilderTables,
};
