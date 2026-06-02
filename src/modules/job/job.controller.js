import jobService from "./job.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";

// ──────────────────────────────────────────────────────────────────────────────
//  GET /job  — paginated, filtered, sorted job list
// ──────────────────────────────────────────────────────────────────────────────
export async function getAllJobs(req, res) {
  try {
    const result = await jobService.getAllJobs(req.query, req.user);

    if (!result.success) {
      return errorResponse(res, result.statusCode || 400, result.message);
    }

    return successResponse(res, result.data, "Jobs fetched successfully");
  } catch (error) {
    console.error("getAllJobs error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  GET /job/:job_id  — full detail of a single job
// ──────────────────────────────────────────────────────────────────────────────
export async function getJobById(req, res) {
  try {
    const { job_id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(job_id)) {
      return errorResponse(res, 400, "Invalid Job ID format");
    }

    const result = await jobService.getJobById(job_id, req.user);

    if (!result.success) {
      return errorResponse(res, result.statusCode || 404, result.message);
    }

    return successResponse(res, result.data, result.message);
  } catch (error) {
    console.error("getJobById error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  POST /job/opportunity/:opportunity_id/convert
// ──────────────────────────────────────────────────────────────────────────────
export async function convertOpportunityToJob(req, res) {
  try {
    const { opportunity_id } = req.params;
    const result = await jobService.convertOpportunityToJob(opportunity_id, req.body);

    if (!result.success) {
      return errorResponse(res, result.statusCode || 400, result.message);
    }

    return successResponse(res, result.data, result.message);
  } catch (error) {
    console.error("convertOpportunityToJob error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  PATCH /job/:job_id/status
// ──────────────────────────────────────────────────────────────────────────────
export async function updateJobStatus(req, res) {
  try {
    const { job_id } = req.params;
    const { status } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(job_id)) {
      return errorResponse(res, 400, "Invalid Job ID format");
    }

    const result = await jobService.updateJobStatus(job_id, status, req.user);

    if (!result.success) {
      return errorResponse(res, result.statusCode || 400, result.message);
    }

    return successResponse(res, result.data, result.message);
  } catch (error) {
    console.error("updateJobStatus error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}
