
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import {
  createConstructionStageService,
  getAllConstructionStagesService,
  updateConstructionStageService,
  deleteConstructionStageService,
} from "./construction-stage.service.js";

export async function createConstructionStage(req, res) {
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  const {
    builder,
    construction_type_id,
    stage_name,
    days = 10,
    sort_order,
    site_image = false,
    inspection = "not_required",
    bg_color,
    font_color,
  } = req.body;

  try {
    const result = await createConstructionStageService({
      builderId,
      companyId,
      userId,
      builder,
      construction_type_id,
      stage_name,
      days,
      sort_order,
      site_image,
      inspection,
      bg_color,
      font_color,
    });

    return successResponse(res, keysToCamelCase(result), "Construction stage created successfully.");
  } catch (error) {
    console.error("Create Construction Stage Error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error.");
  }
}

export async function getAllConstructionStages(req, res) {
  const loggedInBuilderId = req.user.builder_id;
  const { builder, construction_type_id } = req.query;

  try {
    const result = await getAllConstructionStagesService({
      loggedInBuilderId,
      builder,
      construction_type_id,
    });

    return successResponse(res, keysToCamelCase(result), "Construction stages fetched successfully.");
  } catch (error) {
    console.error("Error fetching construction stages:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function updateConstructionStage(req, res) {
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;
  const { construction_stage } = req.params;

  const {
    stage_name,
    days,
    sort_order,
    site_image,
    inspection,
    bg_color,
    font_color,
  } = req.body;

  try {
    if (!builderId) {
      return errorResponse(res, 403, "Unauthorized. Builder login required.");
    }

    if (!construction_stage) {
      return errorResponse(res, 400, "Construction stage ID is required.");
    }

    const result = await updateConstructionStageService({
      builderId,
      companyId,
      userId,
      construction_stage,
      stage_name,
      days,
      sort_order,
      site_image,
      inspection,
      bg_color,
      font_color,
    });

    return successResponse(res, keysToCamelCase(result), "Construction stage updated successfully.");
  } catch (error) {
    console.error("Update Construction Stage Error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error.");
  }
}

export async function deleteConstructionStage(req, res) {
  const builderId = req.user?.builder_id;
  const { construction_stage } = req.params;

  try {
    if (!builderId) {
      return errorResponse(res, 403, "Unauthorized. Builder login required.");
    }

    if (!construction_stage) {
      return errorResponse(res, 400, "Construction stage ID is required.");
    }

    await deleteConstructionStageService({ builderId, construction_stage });

    return successResponse(res, {}, "Construction stage deleted successfully.");
  } catch (error) {
    console.error("Error deleting construction stage:", error);
    return errorResponse(res, error.status || 500, error.message || "Failed to delete construction stage.");
  }
}
