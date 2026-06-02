import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { getAllComplianceTypesService } from "./compliance-type.service.js";

export async function getAllComplianceTypes(req, res) {
  try {
    const complianceTypes = await getAllComplianceTypesService();
    const plainComplianceTypes = complianceTypes.map((ct) => ct.get ? ct.get({ plain: true }) : ct);

    return successResponse(
      res,
      keysToCamelCase(plainComplianceTypes),
      "Compliance types fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Compliance Types Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  }
}
