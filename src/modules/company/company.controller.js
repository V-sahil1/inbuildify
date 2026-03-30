// import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
// import { keysToCamelCase } from "../../utils/common.js";
import {
  upsertCompanyService,
  getCompanyService }
  from "./company.service.js";

// export async function getCompany(req, res) {
//   const pool = getPool();
//   const client = await pool.connect();
//   const builderId = req.user?.builder_id;

//   try {
//     if (!builderId) {
//       return errorResponse(res, 401, "Unauthorized");
//     }

//     const company = await getCompanyByBuilderId(builderId, client);

//     // if (!company) {
//     //   return errorResponse(res, 404, "Company not found");
//     // }

//     return successResponse(
//       res,
//       keysToCamelCase(company),
//       "Company fetched successfully",
//     );
//   } catch (err) {
//     console.error(err);
//     return errorResponse(res, 500, "Internal Server Error");
//   } finally {
//     client.release();
//   }
// }

// export async function upsertCompany(req, res) {
//   const pool = getPool();
//   const client = await pool.connect();
//   const builderId = req.user?.builder_id;

//   try {
//     if (!builderId) {
//       return errorResponse(res, 401, "Unauthorized");
//     }

//     await client.query("BEGIN");

//     const company = await upsertCompanyService(builderId, req.body, client);

//     await client.query("COMMIT");

//     return successResponse(
//       res,
//       keysToCamelCase(company),
//       "Company saved successfully",
//     );
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error(err);
//     return errorResponse(res, 500, err.message);
//   } finally {
//     client.release();
//   }
// }

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
