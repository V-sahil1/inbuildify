import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import addressRepo from "../../repositories/address.repository.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import {
  createPropertyService,
} from "./property.service.js"
import db from "../../config/database/models/postgre-models/index.js";

export async function createProperty(req, res) {
  try {
    const { leads_id } = req.params;
    console.log(req.body);
    const propertyData = { ...req.body };

    // Handle file upload
    if (req.file) {
      propertyData.compaction_report_url = req.file.location;
    }

    const newProperty = await createPropertyService(leads_id, propertyData, req.user);

    const formatted = keysToCamelCase(newProperty);

    return successResponse(
      res,
      formatted,
      "Property created successfully",
    );
  } catch (error) {
    console.error("Error creating property:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

// exports.createProperty = async (req, res) => {
//   const pool = getPool();
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     const builderId = req.user?.builder_id;
//     const companyId = req.user?.company_id;

//     if (!builderId && !companyId) {
//       await client.query("ROLLBACK");
//       return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
//     }

//     const { leads_id } = req.params;

//     const leadCheck = await client.query(
//       `SELECT leads_id, property_detail_id FROM leads WHERE leads_id = $1 AND (
//         (company_id = $2 AND $2 IS NOT NULL)
//         OR (builder_id = $3 AND $3 IS NOT NULL)
//       )`,
//       [leads_id, companyId, builderId]
//     );

//     if (leadCheck.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return errorResponse(res, 400, "Invalid lead id.");
//     }

//     if (leadCheck.rows[0].property_detail_id) {
//       await client.query("ROLLBACK");
//       return errorResponse(res, 400, "Property already exists for this lead. Only one property is allowed per lead.");
//     }

//     const {
//       lot_number,
//       street,
//       address_line1,
//       address_line2,
//       city,
//       state_id,
//       country_id,
//       zip_code,
//       estate_name,
//       title_status,
//       title_date,
//       compaction_report,
//       land_type,
//       width_m,
//       depth_m,
//       total_size_m2,
//       site_fall_mm,
//       land_fill_mm,
//       bush_fire,
//       corner_block,
//     } = req.body;

//     const result = await client.query(
//       `INSERT INTO property_detail (
//         lot_number, street, address_line1, address_line2, city,
//         state_id, country_id, zip_code, estate_name, title_status,
//         title_date, compaction_report, land_type, width_m, depth_m,
//         total_size_m2, site_fall_mm, land_fill_mm, bush_fire, corner_block,
//         is_hl_package_lot,
//         created_at, updated_at
//       ) VALUES (
//         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
//         false,
//         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
//       )
//       RETURNING *`,
//       [
//         lot_number || null,
//         street || null,
//         address_line1 || null,
//         address_line2 || null,
//         city || null,
//         state_id || null,
//         country_id || null,
//         zip_code || null,
//         estate_name || null,
//         title_status || null,
//         title_date || null,
//         compaction_report || null,
//         land_type || "REGULAR",
//         width_m ?? null,
//         depth_m ?? null,
//         total_size_m2 ?? null,
//         site_fall_mm ?? null,
//         land_fill_mm ?? null,
//         bush_fire ?? false,
//         corner_block ?? false,
//       ]
//     );

//     const propertyDetailId = result.rows[0].property_detail_id;

//     // Link property_detail to the lead
//     await client.query(
//       `UPDATE leads SET property_detail_id = $1, updated_at = CURRENT_TIMESTAMP WHERE leads_id = $2`,
//       [propertyDetailId, leads_id]
//     );

//     await client.query("COMMIT");

//     // Re-fetch with state/country/estate names
//     const enriched = await client.query(
//       `SELECT pd.*, s.name AS state_name, c.name AS country_name,
//               es.name AS estate_stage_name
//        FROM property_detail pd
//        LEFT JOIN state s ON s.state_id = pd.state_id
//        LEFT JOIN country c ON c.country_id = pd.country_id
//        LEFT JOIN estate_stages es ON es.estate_stage_id = pd.estate_stage_id
//        WHERE pd.property_detail_id = $1`,
//       [propertyDetailId]
//     );

//     const formatted = keysToCamelCase(enriched.rows[0]);

//     return successResponse(
//       res,
//       formatted,
//       "Property created successfully"
//     );
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error creating property:", error);
//     return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
//   } finally {
//     client.release();
//   }
// };

export async function getPropertyByLeadId(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { leads_id } = req.params;

    const query = `
      SELECT pd.*, s.name AS state_name, c.name AS country_name,
             es.name AS estate_stage_name
      FROM property_detail pd
      JOIN leads l ON l.property_detail_id = pd.property_detail_id
      LEFT JOIN state s ON s.state_id = pd.state_id
      LEFT JOIN country c ON c.country_id = pd.country_id
      LEFT JOIN estate_stages es ON es.estate_stage_id = pd.estate_stage_id
      WHERE l.leads_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const result = await client.query(query, [leads_id, companyId, builderId]);

    if (result.rowCount === 0) {
      return successResponse(res, null, "Property not found for this lead");
    }

    const formatted = keysToCamelCase(result.rows[0]);

    return successResponse(
      res,
      formatted,
      "Property fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching property:", error);
    return errorResponse(res, error?.status || 400, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateProperty(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { property_detail_id } = req.params;
    const { compaction_report, compaction_report_content, compaction_report_url } = req.body;

    const existing = await client.query(
      `SELECT pd.property_detail_id, pd.compaction_report, pd.compaction_report_url
       FROM property_detail pd
       JOIN leads l ON l.property_detail_id = pd.property_detail_id
       WHERE pd.property_detail_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
       )`,
      [property_detail_id, companyId, builderId],
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Property not found or does not belong to your organization.");
    }

    // Business Logic: If status is not_available, clear all details
    if (compaction_report === "not_available") {
      req.body.compaction_report_url = null;
      req.body.compaction_report_content = null;

      // Delete existing file from S3 if any
      const oldUrl = existing.rows[0].compaction_report_url;
      if (oldUrl) {
        await deleteFromS3(oldUrl);
      }
    }

    if (compaction_report === "available" && req.body.compaction_report_provider) {
      return errorResponse(res, 400, "compactionReportProvider is not allowed when compactionReport is available.");
    }

    if (compaction_report === "available") {
      req.body.compaction_report_provider = null;
    }

    const resovedCompactionReport = compaction_report || existing.rows[0].compaction_report;
    if (req.body.compaction_report_provider && resovedCompactionReport === "available" && compaction_report !== "available") {
      return errorResponse(res, 400, "compactionReportProvider is not allowed when compactionReport is available.");
    }

    // Business Logic: Mandatory content when switching to available
    const isSwitchingToAvailable = compaction_report === "available" &&
      existing.rows[0].compaction_report === "not_available";

    const hasNewContent = compaction_report_content !== undefined ||
      compaction_report_url !== undefined ||
      req.file !== undefined;

    if (isSwitchingToAvailable && !hasNewContent) {
      return errorResponse(res, 400, "Compaction report content or file is required when switching status to available.");
    }

    // Business Logic: Check if report details are allowed
    const currentStatus = compaction_report || existing.rows[0].compaction_report;
    const isUpdatingReport = compaction_report_content !== undefined ||
      compaction_report_url !== undefined ||
      req.file !== undefined;

    // if (isUpdatingReport && currentStatus !== "available") {
    //   return errorResponse(res, 400, "Compaction report details can only be provided when the report is available.");
    // }

    const estateId = req.body.estate_id;
    if (estateId) {
      const estateCheck = await client.query(
        "SELECT estate_id FROM estate WHERE estate_id = $1 AND (builder_id = $2 OR company_id = $3) AND status = true",
        [estateId, builderId, companyId],
      );
      if (estateCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid estate id.");
      }
    }

    const estateStageId = req.body.estate_stage_id;
    if (estateStageId) {
      const resolvedEstateId = estateId || (
        await client.query(
          "SELECT estate_id FROM property_detail WHERE property_detail_id = $1",
          [property_detail_id],
        )
      ).rows[0]?.estate_id;

      if (!resolvedEstateId) {
        return errorResponse(res, 400, "Estate must be selected before setting estate stage.");
      }

      const stageCheck = await client.query(
        "SELECT estate_stage_id FROM estate_stages WHERE estate_stage_id = $1 AND estate_id = $2",
        [estateStageId, resolvedEstateId],
      );
      if (stageCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid estate stage id or it does not belong to the selected estate.");
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "lot_number",
      "street",
      "address_line1",
      "address_line2",
      "city",
      "state_id",
      "country_id",
      "zip_code",
      "estate_id",
      "estate_stage_id",
      "estate_name",
      "title_status",
      "title_date",
      "compaction_report",
      "compaction_report_url",
      "compaction_report_content",
      "land_type",
      "width_m",
      "depth_m",
      "total_size_m2",
      "site_fall_mm",
      "land_fill_mm",
      "bush_fire",
      "corner_block",
      "price",
      "clearing_date",
      "compaction_report_provider",
    ];

    // Map body keys to DB column names where they differ
    const fieldMap = {
      address_line1: "address_line1",
      address_line2: "address_line2",
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Skip adding compaction_report_url from the body if a file is already being uploaded
        if (field === "compaction_report_url" && req.file) {
          continue;
        }

        const dbColumn = fieldMap[field] || field;
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        updateValues.push(req.body[field] === null ? null : req.body[field]);
      }
    }

    if (updateFields.length === 0 && !req.file) {
      return errorResponse(res, 400, "No valid fields to update");
    }

    if (req.file) {
      const oldUrl = existing.rows[0].compaction_report_url;
      if (oldUrl) {
        await deleteFromS3(oldUrl);
      }
      const dbColumn = "compaction_report_url";
      updateFields.push(`${dbColumn} = $${paramIndex++}`);
      updateValues.push(req.file.location);
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateValues.push(property_detail_id);

    const updateSql = `
      UPDATE property_detail
      SET ${updateFields.join(", ")}
      WHERE property_detail_id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateSql, updateValues);
    const updatedProperty = result.rows[0];

    // Business Logic: Create Base Price and Compaction Report Charge if compaction_report_provider is 'builder'
    const currentProvider = req.body.compaction_report_provider || updatedProperty.compaction_report_provider;
    if (currentProvider === "builder") {
      const { PriceList, PriceListItem } = db;
      const userId = req.user?.user_id;

      // Create or find "Base Price" PriceList
      const [priceList] = await PriceList.findOrCreate({
        where: {
          builder_id: builderId,
          name: "Base Price",
        },
        defaults: {
          company_id: companyId || null,
          builder_id: builderId,
          name: "Base Price",
          sort_order: 1,
          is_active: true,
          created_by: userId || null,
        },
      });

      // Create or find default PriceListItem for this PriceList
      await PriceListItem.findOrCreate({
        where: {
          price_list_id: priceList.price_list_id,
          item_description: "Compaction Report Charge",
        },
        defaults: {
          price_list_id: priceList.price_list_id,
          company_id: companyId || null,
          builder_id: builderId,
          item_description: "Compaction Report Charge",
          cost_type: "Fixed",
          cost: 250.00,
          builder_cost: 100.00,
          status: "active",
          created_by: userId || null,
          is_system_data: true,
        },
      });
    }

    // Re-fetch with state/country/estate names
    const enriched = await client.query(
      `SELECT pd.*, s.name AS state_name, c.name AS country_name,
              es.name AS estate_stage_name
       FROM property_detail pd
       LEFT JOIN state s ON s.state_id = pd.state_id
       LEFT JOIN country c ON c.country_id = pd.country_id
       LEFT JOIN estate_stages es ON es.estate_stage_id = pd.estate_stage_id
       WHERE pd.property_detail_id = $1`,
      [property_detail_id],
    );

    const formatted = keysToCamelCase(enriched.rows[0]);

    return successResponse(
      res,
      formatted,
      "Property updated successfully",
    );
  } catch (error) {
    console.error("Error updating property:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllProperties(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { search } = req.query;

    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    whereConditions.push(`(
      (l.company_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
      OR (l.builder_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
    )`);
    queryParams.push(companyId, builderId);

    if (search) {
      whereConditions.push(`(
        pd.estate_name ILIKE $${paramIndex++} OR
        pd.title_status ILIKE $${paramIndex++} OR
        pd.address_line1 ILIKE $${paramIndex++} OR
        pd.city ILIKE $${paramIndex++} OR
        pd.zip_code ILIKE $${paramIndex++}
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT pd.*
      FROM property_detail pd
      JOIN leads l ON l.property_detail_id = pd.property_detail_id
      ${whereClause}
      ORDER BY pd.created_at DESC
    `;

    const result = await client.query(query, queryParams);

    const formattedData = result.rows.map(row => keysToCamelCase(row));

    return successResponse(
      res,
      formattedData,
      "Properties fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching properties:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteProperty(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { property_detail_id } = req.params;

    const existing = await client.query(
      `SELECT pd.property_detail_id
       FROM property_detail pd
       JOIN leads l ON l.property_detail_id = pd.property_detail_id
       WHERE pd.property_detail_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
       )`,
      [property_detail_id, companyId, builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Property not found or does not belong to your organization.");
    }

    // Unlink from leads first
    await client.query(
      "UPDATE leads SET property_detail_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE property_detail_id = $1",
      [property_detail_id],
    );

    await client.query("DELETE FROM property_detail WHERE property_detail_id = $1", [property_detail_id]);

    await client.query("COMMIT");

    return successResponse(res, null, "Property deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting property:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
