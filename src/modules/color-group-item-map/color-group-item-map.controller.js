import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createColorGroupItemMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { color_group_id, color_item_id } = req.body;

    if (!color_group_id || !color_item_id) {
      return errorResponse(
        res,
        400,
        "Color group ID and color item ID are required.",
      );
    }

    await client.query("BEGIN");

    const colorGroupCheck = await client.query(
      `
      SELECT color_group_id, name 
      FROM color_group
      WHERE color_group_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_group_id, companyId, builderId],
    );

    if (colorGroupCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Color group not found or does not belong to your organization.",
      );
    }

    const colorItemCheck = await client.query(
      `
      SELECT color_item_id, item_name 
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (colorItemCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Color item not found or does not belong to your organization.",
      );
    }

    const duplicateCheck = await client.query(
      `
      SELECT id 
      FROM color_group_item_map
      WHERE color_group_id = $1 AND color_item_id = $2
      `,
      [color_group_id, color_item_id],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "This color item is already mapped to this color group.",
      );
    }

    const { rows } = await client.query(
      `
      INSERT INTO color_group_item_map
      (color_group_id, color_item_id)
      VALUES ($1, $2)
      RETURNING *
      `,
      [color_group_id, color_item_id],
    );

    await client.query("COMMIT");

    const newMapping = rows[0];
    const response = {
      id: newMapping.id,
      colorGroupId: newMapping.color_group_id,
      colorItemId: newMapping.color_item_id,
      createdAt: newMapping.created_at,
      updatedAt: newMapping.updated_at,
    };

    return successResponse(
      res,
      keysToCamelCase(response),
      "Color group item mapping created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Color Group Item Map Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllColorGroupItemMaps(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { color_group_id, color_item_id, page = 1, limit = 25 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = `
      WHERE (cg.company_id = $1 OR cg.builder_id = $2)
        AND (ci.company_id = $1 OR ci.builder_id = $2)
    `;
    const values = [companyId, builderId];
    let paramIndex = 3;

    if (color_group_id) {
      whereClause += ` AND cgim.color_group_id = $${paramIndex++}`;
      values.push(color_group_id);
    }

    if (color_item_id) {
      whereClause += ` AND cgim.color_item_id = $${paramIndex++}`;
      values.push(color_item_id);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM color_group_item_map cgim
      INNER JOIN color_group cg ON cg.color_group_id = cgim.color_group_id
      INNER JOIN color_item ci ON ci.color_item_id = cgim.color_item_id
      ${whereClause};
    `;

    const listQuery = `
      SELECT 
        cgim.id,
        cgim.color_group_id,
        cgim.color_item_id,
        cgim.created_at,
        cgim.updated_at
      FROM color_group_item_map cgim
      INNER JOIN color_group cg ON cg.color_group_id = cgim.color_group_id
      INNER JOIN color_item ci ON ci.color_item_id = cgim.color_item_id
      ${whereClause}
      ORDER BY cgim.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset};
    `;

    const [countResult, listResult] = await Promise.all([
      client.query(countQuery, values),
      client.query(listQuery, values),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    const mappings = listResult.rows.map((row) =>
      keysToCamelCase({
        id: row.id,
        colorGroupId: row.color_group_id,
        colorItemId: row.color_item_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );

    return successResponse(
      res,
      {
        mappings,
        pagination: {
          totalRecords: total,
          currentPage: pageNum,
          totalPages,
          limit: limitNum,
        },
      },
      "Color group item mappings retrieved successfully.",
    );
  } catch (error) {
    console.error("Get All Color Group Item Maps Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteColorGroupItemMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 400, "Mapping ID is required.");
    }

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT cgim.id
      FROM color_group_item_map cgim
      INNER JOIN color_group cg ON cg.color_group_id = cgim.color_group_id
      INNER JOIN color_item ci ON ci.color_item_id = cgim.color_item_id
      WHERE cgim.id = $1
        AND (cg.company_id = $2 OR cg.builder_id = $3)
        AND (ci.company_id = $2 OR ci.builder_id = $3)
      `,
      [id, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Color group item mapping not found or does not belong to your organization.",
      );
    }

    await client.query("DELETE FROM color_group_item_map WHERE id = $1", [id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Color group item mapping deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Color Group Item Map Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}
