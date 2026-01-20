const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createFloorPlanPricelistItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      floor_plan_id,
      price_list_item_id,
      include_default,
      modify,
      quantity,
    } = req.body;

    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!floor_plan_id) {
      return errorResponse(res, 400, "floor_plan_id is required");
    }

    if (!price_list_item_id) {
      return errorResponse(res, 400, "price_list_item_id is required");
    }

    // Check if floor plan exists and user has access
    const floorPlanCheck = await client.query(
      `SELECT floor_plan_id FROM floor_plan WHERE floor_plan_id = $1 AND (builder_id = $2 OR company_id = $3)`,
      [floor_plan_id, builderId, companyId],
    );
    if (floorPlanCheck.rowCount === 0) {
      return errorResponse(res, 400, "Invalid floor_plan_id or access denied");
    }

    // Check if price list item exists and user has access
    const priceListItemCheck = await client.query(
      `SELECT price_list_item_id FROM price_list_item WHERE price_list_item_id = $1 AND (builder_id = $2 OR company_id = $3)`,
      [price_list_item_id, builderId, companyId],
    );
    if (priceListItemCheck.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "Invalid price_list_item_id or access denied",
      );
    }

    const insertResult = await client.query(
      `
      INSERT INTO floor_plan_pricelist_item_map (
        floor_plan_id,
        price_list_item_id,
        inclide_default,
        modify,
        quantity
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      [
        floor_plan_id,
        price_list_item_id,
        include_default !== undefined ? include_default : false,
        modify !== undefined ? modify : false,
        quantity !== undefined ? quantity : null,
      ],
    );

    const floorPlanPricelistItemMapId = insertResult.rows[0].id;

    const responseQuery = `
      SELECT
        fppim.id,
        fppim.inclide_default,
        fppim.modify,
        fppim.quantity,
      
        json_build_object(
          'id', fp.floor_plan_id,
          'name', fp.name
        ) as floor_plan,
        json_build_object(
          'id', pli.price_list_item_id,
          'name', pli.item_description
        ) as pricelist_item,
           fppim.created_at,
        fppim.updated_at
      FROM floor_plan_pricelist_item_map fppim
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id
      LEFT JOIN price_list_item pli ON pli.price_list_item_id = fppim.price_list_item_id
      WHERE fppim.id = $1 AND (fp.builder_id = $2 OR fp.company_id = $3);
    `;

    const responseResult = await client.query(responseQuery, [
      floorPlanPricelistItemMapId,
      builderId,
      companyId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Floor plan price list item map created successfully.",
    );
  } catch (error) {
    console.error("Create Floor Plan Price List Item Map Error:", error);

    // Handle unique constraint violation
    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "This price list item is already mapped to the floor plan.",
      );
    }

    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllFloorPlanPricelistItemMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      page = 1,
      limit = 25,
      floor_plan_id,
      price_list_item_id,
      include_default,
      modify,
    } = req.query;

    const { builder_id: builderId, company_id: companyId } = req.user;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offsetValue = (pageValue - 1) * limitValue;

    let whereClause = "WHERE (fp.builder_id = $1 OR fp.company_id = $2)";
    let values = [builderId, companyId];
    let paramIndex = values.length + 1;

    // Add filters
    if (floor_plan_id) {
      whereClause += ` AND fppim.floor_plan_id = $${paramIndex++}`;
      values.push(floor_plan_id);
    }

    if (price_list_item_id) {
      whereClause += ` AND fppim.price_list_item_id = $${paramIndex++}`;
      values.push(price_list_item_id);
    }

    if (include_default !== undefined) {
      whereClause += ` AND fppim.inclide_default = $${paramIndex++}`;
      values.push(include_default === "true");
    }

    if (modify !== undefined) {
      whereClause += ` AND fppim.modify = $${paramIndex++}`;
      values.push(modify === "true");
    }

    const dataQuery = `
      SELECT
        fppim.id,
        fppim.inclide_default,
        fppim.modify,
        fppim.quantity,
      
        json_build_object(
          'id', fp.floor_plan_id,
          'name', fp.name
        ) as floor_plan,
        json_build_object(
          'id', pli.price_list_item_id,
          'name', pli.item_description
        ) as pricelist_item,
           fppim.created_at,
        fppim.updated_at
      FROM floor_plan_pricelist_item_map fppim
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id
      LEFT JOIN price_list_item pli ON pli.price_list_item_id = fppim.price_list_item_id
      ${whereClause}
      ORDER BY fppim.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataResult = await client.query(dataQuery, [
      ...values,
      limitValue,
      offsetValue,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM floor_plan_pricelist_item_map fppim
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id
      LEFT JOIN price_list_item pli ON pli.price_list_item_id = fppim.price_list_item_id
      ${whereClause};
    `;

    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        mappings: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Floor plan price list item maps fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Floor Plan Price List Item Maps Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getFloorPlanPricelistItemMapById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!id) {
      return errorResponse(res, 400, "id is required.");
    }

    const query = `
      SELECT
        fppim.id,
        fppim.inclide_default,
        fppim.modify,
        fppim.quantity,
       
        json_build_object(
          'id', fp.floor_plan_id,
          'name', fp.name
        ) as floor_plan,
        json_build_object(
          'id', pli.price_list_item_id,
          'name', pli.item_description
        ) as pricelist_item,
          fppim.created_at,
        fppim.updated_at
      FROM floor_plan_pricelist_item_map fppim
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id
      LEFT JOIN price_list_item pli ON pli.price_list_item_id = fppim.price_list_item_id
      WHERE fppim.id = $1 AND (fp.builder_id = $2 OR fp.company_id = $3);
    `;

    const result = await client.query(query, [id, builderId, companyId]);

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Floor plan price list item map not found or access denied.",
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Floor plan price list item map fetched successfully.",
    );
  } catch (error) {
    console.error("Get Floor Plan Price List Item Map By ID Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateFloorPlanPricelistItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { include_default, modify, quantity } = req.body;

    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!id) {
      return errorResponse(res, 400, "id is required.");
    }

    const existingResult = await client.query(
      `SELECT fppim.*, fp.builder_id, fp.company_id FROM floor_plan_pricelist_item_map fppim
       LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id 
       WHERE fppim.id = $1`,
      [id],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Floor plan price list item map not found.",
      );
    }

    if (
      existingResult.rows[0].builder_id !== builderId &&
      existingResult.rows[0].company_id !== companyId
    ) {
      return errorResponse(
        res,
        403,
        "Access denied - you can only update your own records.",
      );
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (include_default !== undefined) {
      updateFields.push(`inclide_default = $${idx++}`);
      updateValues.push(include_default);
    }

    if (modify !== undefined) {
      updateFields.push(`modify = $${idx++}`);
      updateValues.push(modify);
    }

    if (quantity !== undefined) {
      updateFields.push(`quantity = $${idx++}`);
      updateValues.push(quantity);
    }

    if (updateFields.length === 0) {
      return errorResponse(
        res,
        400,
        "At least one field is required for update.",
      );
    }

    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `UPDATE floor_plan_pricelist_item_map SET ${updateFields.join(", ")} 
       WHERE id = $${idx}`,
      [...updateValues, id],
    );

    const responseQuery = `
      SELECT
        fppim.id,
        fppim.inclide_default,
        fppim.modify,
        fppim.quantity,
      
        json_build_object(
          'id', fp.floor_plan_id,
          'name', fp.name
        ) as floor_plan,
        json_build_object(
          'id', pli.price_list_item_id,
          'name', pli.item_description
        ) as pricelist_item,
           fppim.created_at,
        fppim.updated_at
      FROM floor_plan_pricelist_item_map fppim
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id
      LEFT JOIN price_list_item pli ON pli.price_list_item_id = fppim.price_list_item_id
      WHERE fppim.id = $1 AND (fp.builder_id = $2 OR fp.company_id = $3);
    `;

    const responseResult = await client.query(responseQuery, [
      id,
      builderId,
      companyId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Floor plan price list item map updated successfully.",
    );
  } catch (error) {
    console.error("Update Floor Plan Price List Item Map Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.deleteFloorPlanPricelistItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!id) {
      return errorResponse(res, 400, "id is required.");
    }

    const checkResult = await client.query(
      `SELECT fppim.*, fp.builder_id, fp.company_id FROM floor_plan_pricelist_item_map fppim
       LEFT JOIN floor_plan fp ON fp.floor_plan_id = fppim.floor_plan_id 
       WHERE fppim.id = $1`,
      [id],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Floor plan price list item map not found.",
      );
    }

    if (
      checkResult.rows[0].builder_id !== builderId &&
      checkResult.rows[0].company_id !== companyId
    ) {
      return errorResponse(
        res,
        403,
        "Access denied - you can only delete your own records.",
      );
    }

    await client.query(
      `DELETE FROM floor_plan_pricelist_item_map WHERE id = $1`,
      [id],
    );

    return successResponse(
      res,
      {},
      "Floor plan price list item map deleted successfully.",
    );
  } catch (error) {
    console.error("Delete Floor Plan Price List Item Map Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
