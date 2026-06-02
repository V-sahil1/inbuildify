import { errorResponse, successResponse } from "../../helper/response.js";
import { getScreensService } from "./screen.service.js";

export async function getScreens(req, res) {
  try {
    const result = await getScreensService();

    return successResponse(
      res,
      result.data,
      "Screens fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching screens:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  }
}
