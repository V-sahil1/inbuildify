const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createQuotation = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const builderId = req.user.builder_id;
  const {
    range,
    dwellingType,
    leadId,
    propertyId,
    floorPlanId,
    facadeId,
    packageId,
    items,
  } = req.body;

  try {
    await client.query("BEGIN");

    const rangeQuery = `SELECT range_id FROM range WHERE name = $1;`;
    const rangeResult = await client.query(rangeQuery, [range]);
    const rangeId = rangeResult.rows[0]?.range_id;
    if (!rangeId) {
      return errorResponse(
        res,
        400,
        "Invalid range ID or range does not exist."
      );
    }

    const dwellingTypeQuery = `SELECT dwelling_type_id FROM dwelling_type WHERE name = $1;`;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [
      dwellingType,
    ]);
    const dwellingTypeId = dwellingTypeResult.rows[0]?.dwelling_type_id;
    if (!dwellingTypeId) {
      return errorResponse(
        res,
        400,
        "Invalid dwelling type ID or dwelling type does not exist."
      );
    }

    const validationQuery = `
      SELECT 
        (SELECT COUNT(*) FROM leads WHERE lead_id = $2 AND status = 'IN_PROGRESS') as lead_exists,
        (SELECT COUNT(*) FROM property WHERE property_id = $3 AND builder_id = $1 AND lead_id = $2) as property_exists,
        (SELECT COUNT(*) FROM floor_plan WHERE floor_plan_id = $4 AND builder_id = $1 AND range_id = $7 AND dwelling_type_id = $8) as floor_plan_exists,
        (SELECT COUNT(*) FROM facade WHERE facade_id = $5 AND builder_id = $1 AND dwelling_type_id = $8) as facade_exists,
        (SELECT COUNT(*) FROM packages p LEFT JOIN category_items ci ON ci.category_item_id = ANY(p.category_item_ids) WHERE p.package_id = $6 AND p.builder_id = $1 AND ci.range_id = $7 AND ci.dwelling_type_id = $8 AND ci.status = 'ACTIVE') as package_exists;
    `;
    const validationResult = await client.query(validationQuery, [
      builderId,
      leadId,
      propertyId,
      floorPlanId,
      facadeId,
      packageId,
      rangeId,
      dwellingTypeId,
    ]);
    const row = validationResult.rows[0];

    if (
      row.lead_exists == 0 ||
      row.property_exists == 0 ||
      row.floor_plan_exists == 0 ||
      row.facade_exists == 0 ||
      row.package_exists == 0
    ) {
      return errorResponse(
        res,
        400,
        "Invalid reference IDs or IDs do not belong to builder."
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(
        res,
        400,
        "Items array is required and must not be empty."
      );
    }
    for (const item of items) {
      if (
        !item.itemId ||
        typeof item.quantity !== "number" ||
        typeof item.price !== "number" ||
        typeof item.total !== "number"
      ) {
        return errorResponse(
          res,
          400,
          "Each item must have itemId, quantity, price, total which are of type number."
        );
      }
    }

    const insertQuotationQuery = `
      INSERT INTO quotation (
        builder_id, lead_id, property_id, floor_plan_id, facade_id, package_id, range_id, dwelling_type_id, items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const quotationResult = await client.query(insertQuotationQuery, [
      builderId,
      leadId,
      propertyId,
      floorPlanId,
      facadeId,
      packageId,
      rangeId,
      dwellingTypeId,
      JSON.stringify(items),
    ]);
    const quotation = quotationResult.rows[0];

    await client.query(
      `UPDATE leads SET status = 'COMPLETED' WHERE lead_id = $1`,
      [leadId]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(quotation),
      "Quotation created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(
      res,
      error?.code || 400,
      error?.message || "Error creating quotation"
    );
  } finally {
    client.release();
  }
};

exports.getQuotationById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { quotation_id } = req.params;
  const builderId = req.user.builder_id;

  try {
    const query = `
        SELECT 
          q.quotation_id, q.created_at, q.updated_at, q.items,
          b.builder_id, b.name as builder_name,
          l.lead_id, l.status as lead_status,
          p.property_id, p.address1 as property_address,
          f.floor_plan_id, f.name as floor_plan_name,
          fa.facade_id, fa.name as facade_name,
          pk.package_id, pk.name as package_name,
          r.range_id, r.name as range_name,
          dt.dwelling_type_id, dt.name as dwelling_type_name
        FROM quotation q
        JOIN builder b ON q.builder_id = b.builder_id
        JOIN leads l ON q.lead_id = l.lead_id
        JOIN property p ON q.property_id = p.property_id
        JOIN floor_plan f ON q.floor_plan_id = f.floor_plan_id
        JOIN facade fa ON q.facade_id = fa.facade_id
        JOIN packages pk ON q.package_id = pk.package_id
        JOIN range r ON q.range_id = r.range_id
        JOIN dwelling_type dt ON q.dwelling_type_id = dt.dwelling_type_id
        WHERE q.quotation_id = $1 AND q.builder_id = $2;
      `;

    const result = await client.query(query, [quotation_id, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "Quotation not found.");
    }

    const row = keysToCamelCase(result.rows[0]);

    let items = [];
    try {
      items = Array.isArray(row.items)
        ? row.items
        : JSON.parse(row.items || "[]");
    } catch {
      items = [];
    }

    const responseData = {
      quotationId: row.quotationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items,

      builder: {
        builderId: row.builderId,
        name: row.builderName,
      },
      lead: {
        leadId: row.leadId,
        status: row.leadStatus,
      },
      property: {
        propertyId: row.propertyId,
        address: row.propertyAddress,
      },
      floorPlan: {
        floorPlanId: row.floorPlanId,
        name: row.floorPlanName,
      },
      facade: {
        facadeId: row.facadeId,
        name: row.facadeName,
      },
      package: {
        packageId: row.packageId,
        name: row.packageName,
      },
      range: {
        rangeId: row.rangeId,
        name: row.rangeName,
      },
      dwellingType: {
        dwellingTypeId: row.dwellingTypeId,
        name: row.dwellingTypeName,
      },
    };

    return successResponse(
      res,
      responseData,
      "Quotation fetched successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      error?.code || 400,
      error?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};
