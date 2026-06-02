import { successResponse, errorResponse } from "../../helper/response.js";
import {
  upsertCompanyService,
  getCompanyService }
  from "./company.service.js";

export async function getCompany(req, res) {
  const builderId = req.user?.builder_id;

  try {
    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const company = await getCompanyService({ builderId });

    return successResponse(res, company, "Company fetched successfully");
  } catch (err) {
    console.error("Error fetching company:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  }
}

export async function upsertCompany(req, res) {
  const builderId = req.user?.builder_id;

  try {
    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const company = await upsertCompanyService(builderId, req.body);

    return successResponse(res, company, "Company saved successfully");
  } catch (err) {
    console.error("Error upserting company:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  }
}
