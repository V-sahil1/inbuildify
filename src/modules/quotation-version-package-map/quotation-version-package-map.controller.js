// import getPool from "../../config/database.js";
// import { errorResponse, successResponse } from "../../helper/response.js";
// import { keysToCamelCase } from "../../utils/common.js";

// // Create package map
// export async function createPackageMap(req, res) {
//   const pool = getPool();
//   const client = await pool.connect();

//   try {
//     const { quotation_version_id, package_id } = req.body;
//     const builderId = req.user?.builder_id;
//     const companyId = req.user?.company_id;

//     if (!builderId && !companyId) {
//       return errorResponse(res, 401, "Unauthorized");
//     }

//     // Validate quotation version ownership
//     const versionCheck = await client.query(
//       `SELECT qv.quotation_version_id, qv.is_approve
//        FROM quotation_version qv
//        JOIN quotation q ON qv.quotation_id = q.quotation_id
//        JOIN leads l ON q.leads_id = l.leads_id
//        WHERE qv.quotation_version_id = $1 AND (
//          (l.company_id = $2 AND $2 IS NOT NULL)
//          OR (l.builder_id = $3 AND $3 IS NOT NULL)
//        ) LIMIT 1`,
//       [quotation_version_id, companyId, builderId],
//     );

//     if (versionCheck.rowCount === 0) {
//       return errorResponse(res, 404, "Quotation version not found or does not belong to your organization");
//     }

//     if (versionCheck.rows[0].is_approve === true) {
//       return errorResponse(res, 400, "Cannot modify packages of an approved quotation version");
//     }

//     // Validate package exists and belongs to the user's organization
//     const packageCheck = await client.query(
//       `SELECT package_id FROM package WHERE package_id = $1 AND status = true AND (
//         (company_id = $2 AND $2 IS NOT NULL)
//         OR (builder_id = $3 AND $3 IS NOT NULL)
//       ) LIMIT 1`,
//       [package_id, companyId, builderId],
//     );

//     if (packageCheck.rowCount === 0) {
//       return errorResponse(res, 404, "Package not found or does not belong to your organization or package is not active");
//     }

//     // Check for duplicate mapping
//     const duplicateCheck = await client.query(
//       `SELECT id FROM quotation_version_package_map
//        WHERE quotation_version_id = $1 AND package_id = $2 LIMIT 1`,
//       [quotation_version_id, package_id],
//     );

//     if (duplicateCheck.rowCount > 0) {
//       return errorResponse(res, 409, "This package is already mapped to the quotation version");
//     }

//     const result = await client.query(
//       `INSERT INTO quotation_version_package_map 
//        (quotation_version_id, package_id) 
//        VALUES ($1, $2) 
//        RETURNING *`,
//       [quotation_version_id, package_id],
//     );

//     // Fetch the package cost to include in response
//     const packageData = await client.query(
//       "SELECT cost FROM package WHERE package_id = $1",
//       [package_id],
//     );

//     const responseData = {
//       ...keysToCamelCase(result.rows[0]),
//       price: packageData.rows[0]?.cost || null,
//     };

//     return successResponse(res, responseData, 201, "Package mapped successfully");
//   } catch (error) {
//     console.error("Create package map error:", error);
//     return errorResponse(res, 500, "Internal server error");
//   } finally {
//     client.release();
//   }
// }

// // Get all packages by quotation version id
// export async function getPackagesByVersionId(req, res) {
//   const pool = getPool();
//   const client = await pool.connect();

//   try {
//     const { quotation_version_id } = req.params;
//     const builderId = req.user?.builder_id;
//     const companyId = req.user?.company_id;

//     if (!builderId && !companyId) {
//       return errorResponse(res, 401, "Unauthorized");
//     }

//     // Validate quotation version ownership
//     const versionCheck = await client.query(
//       `SELECT qv.quotation_version_id
//        FROM quotation_version qv
//        JOIN quotation q ON qv.quotation_id = q.quotation_id
//        JOIN leads l ON q.leads_id = l.leads_id
//        WHERE qv.quotation_version_id = $1 AND (
//          (l.company_id = $2 AND $2 IS NOT NULL)
//          OR (l.builder_id = $3 AND $3 IS NOT NULL)
//        ) LIMIT 1`,
//       [quotation_version_id, companyId, builderId],
//     );

//     if (versionCheck.rowCount === 0) {
//       return errorResponse(res, 404, "Quotation version not found or does not belong to your organization");
//     }

//     const result = await client.query(
//       `SELECT m.*, p.name as package_name, p.cost as price
//        FROM quotation_version_package_map m
//        LEFT JOIN package p ON m.package_id = p.package_id
//        WHERE m.quotation_version_id = $1
//        ORDER BY m.created_at ASC`,
//       [quotation_version_id],
//     );

//     return successResponse(
//       res,
//       result.rows.map(row => keysToCamelCase(row)),
//       "Package maps fetched successfully",
//     );
//   } catch (error) {
//     console.error("Get package maps error:", error);
//     return errorResponse(res, 500, "Internal server error");
//   } finally {
//     client.release();
//   }
// }

// // Delete package map
// export async function deletePackageMap(req, res) {
//   const pool = getPool();
//   const client = await pool.connect();

//   try {
//     const { id } = req.params;
//     const builderId = req.user?.builder_id;
//     const companyId = req.user?.company_id;

//     if (!builderId && !companyId) {
//       return errorResponse(res, 401, "Unauthorized");
//     }

//     // Check ownership
//     const checkResult = await client.query(
//       `SELECT m.id, qv.is_approve
//        FROM quotation_version_package_map m
//        JOIN quotation_version qv ON m.quotation_version_id = qv.quotation_version_id
//        JOIN quotation q ON qv.quotation_id = q.quotation_id
//        JOIN leads l ON q.leads_id = l.leads_id
//        WHERE m.id = $1 AND (
//          (l.company_id = $2 AND $2 IS NOT NULL)
//          OR (l.builder_id = $3 AND $3 IS NOT NULL)
//        ) LIMIT 1`,
//       [id, companyId, builderId],
//     );

//     if (checkResult.rowCount === 0) {
//       return errorResponse(res, 404, "Package map not found or does not belong to your organization");
//     }

//     if (checkResult.rows[0].is_approve === true) {
//       return errorResponse(res, 400, "Cannot modify packages of an approved quotation version");
//     }

//     await client.query(
//       "DELETE FROM quotation_version_package_map WHERE id = $1",
//       [id],
//     );

//     return successResponse(res, null, "Package map deleted successfully");
//   } catch (error) {
//     console.error("Delete package map error:", error);
//     return errorResponse(res, 500, "Internal server error");
//   } finally {
//     client.release();
//   }
// }

// export default {
//   createPackageMap,
//   getPackagesByVersionId,
//   deletePackageMap,
// };
