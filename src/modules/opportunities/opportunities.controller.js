import opportunitiesService from "./opportunities.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";

/**
 * Converts a lead into an opportunity
 */
export async function createOpportunity(req, res) {
  try {
    const { lead_id } = req.params;
    const builderId = req.user.builder_id;

    const result = await opportunitiesService.createOpportunity(lead_id, builderId);

    return successResponse(
      res,
      result.data,
      result.message
    );
  } catch (error) {
    console.error("Create opportunity error:", error);
    return errorResponse(
      res, 
      error?.status || 400, 
      error?.message || "Internal server error"
    );
  }
}

/**
 * Fetches all opportunities for the current builder
 */
export async function getAllOpportunities(req, res) {
  try {
    const { lead_id } = req.query;
    const builderId = req.user.builder_id;

    const result = await opportunitiesService.getAllOpportunities(builderId, lead_id);

    return successResponse(
      res,
      result.data,
      result.message
    );
  } catch (error) {
    console.error("Get all opportunities error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}
