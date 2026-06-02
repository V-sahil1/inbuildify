import { successResponse, errorResponse } from "../../helper/response.js";
import { getAllRoleService } from "./role.service.js";

export async function getAllRole(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await getAllRoleService(page, limit);

    return successResponse(
      res,
      result.data,
      "Role fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching role:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  }
}
