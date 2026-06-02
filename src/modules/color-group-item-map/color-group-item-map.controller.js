import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import {
  createColorGroupItemMapService,
  getAllColorGroupItemMapsService,
  deleteColorGroupItemMapService,
} from "./color-group-item-map.service.js";

export async function createColorGroupItemMap(req, res) {
  try {
    const newMapping = await createColorGroupItemMapService(req.user, req.body);

    return successResponse(
      res,
      keysToCamelCase(newMapping),
      "Color group item mapping created successfully.",
    );
  } catch (error) {
    console.error("Create Color Group Item Map Error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function getAllColorGroupItemMaps(req, res) {
  try {
    const data = await getAllColorGroupItemMapsService(req.user, req.query);

    return successResponse(
      res,
      {
        mappings: keysToCamelCase(data.mappings),
        pagination: data.pagination,
      },
      "Color group item mappings retrieved successfully.",
    );
  } catch (error) {
    console.error("Get All Color Group Item Maps Error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function deleteColorGroupItemMap(req, res) {
  try {
    const { id } = req.params;
    await deleteColorGroupItemMapService(req.user, id);

    return successResponse(
      res,
      null,
      "Color group item mapping deleted successfully.",
    );
  } catch (error) {
    console.error("Delete Color Group Item Map Error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}
