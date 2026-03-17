import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createHouseFeature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    const { name, description, company_id, builder_id } = req.body;

    await client.query("BEGIN");

    const sql = `
      INSERT INTO house_feature (
        company_id,
        builder_id,
        name,
        description,
        created_by,
        updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING *
    `;

    const values = [
      company_id || companyId || null,
      builder_id || builderId || null,
      name,
      description || null,
      userId,
      userId,
    ];

    const result = await client.query(sql, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House feature created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create house feature error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function getAllHouseFeatures(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const { page = 1, limit = 25, company_id, builder_id, search } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (company_id) {
      whereConditions.push(`company_id = $${paramIndex++}`);
      queryParams.push(company_id);
    }

    if (builder_id) {
      whereConditions.push(`builder_id = $${paramIndex++}`);
      queryParams.push(builder_id);
    }

    if (search) {
      whereConditions.push(`(
        name ILIKE $${paramIndex++} OR
        description ILIKE $${paramIndex++}
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    whereConditions.push(
      `(company_id = $${paramIndex++} OR builder_id = $${paramIndex++})`,
    );
    queryParams.push(companyId || null, builderId);

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const countSql = `SELECT COUNT(*) as total FROM house_feature ${whereClause}`;
    const countResult = await client.query(countSql, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const dataSql = `
      SELECT * FROM house_feature 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(parseInt(limit), offset);

    const dataResult = await client.query(dataSql, queryParams);

    return successResponse(
      res,
      {
        houseFeatures: dataResult.rows.map(keysToCamelCase),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "House features retrieved successfully",
    );
  } catch (error) {
    console.error("Get all house features error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function getHouseFeatureById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_feature_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const sql = `
      SELECT * FROM house_feature 
      WHERE house_feature_id = $1 
        AND (company_id = $2 OR builder_id = $3)
    `;
    const result = await client.query(sql, [
      house_feature_id,
      companyId,
      builderId,
    ]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "House feature not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House feature retrieved successfully",
    );
  } catch (error) {
    console.error("Get house feature by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateHouseFeature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_feature_id } = req.params;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    const checkSql = `
      SELECT * FROM house_feature 
      WHERE house_feature_id = $1 
        AND (company_id = $2 OR builder_id = $3)
    `;
    const checkResult = await client.query(checkSql, [
      house_feature_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "House feature not found");
    }

    await client.query("BEGIN");

    const { name, description, company_id, builder_id } = req.body;

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = ["name", "description", "company_id", "builder_id"];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        updateValues.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields to update");
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);

    const sql = `
      UPDATE house_feature 
      SET ${updateFields.join(", ")}
      WHERE house_feature_id = $${paramIndex}
      RETURNING *
    `;
    updateValues.push(house_feature_id);

    const result = await client.query(sql, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House feature updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update house feature error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function deleteHouseFeature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_feature_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    const checkSql = `
      SELECT * FROM house_feature 
      WHERE house_feature_id = $1 
        AND (company_id = $2 OR builder_id = $3)
    `;
    const checkResult = await client.query(checkSql, [
      house_feature_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "House feature not found");
    }

    await client.query("BEGIN");

    const sql =
      "DELETE FROM house_feature WHERE house_feature_id = $1 RETURNING *";
    const result = await client.query(sql, [house_feature_id]);
    await client.query("COMMIT");

    return successResponse(res, "House feature deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete house feature error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
