const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createDrive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { name } = req.body;
    const { user_id, company_id, builder_id } = req.user;

    if (!name) {
      return errorResponse(res, 400, "Name is required");
    }

    if (!company_id && !builder_id) {
      return errorResponse(res, 400, "User must be associated with either company or builder");
    }

    const duplicateCheck = await client.query(
      `
      SELECT drive_id FROM drive 
      WHERE name = $1 AND (company_id = $2 OR builder_id = $3)
      `,
      [name, company_id, builder_id]
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 400, "Drive name already exists");
    }

    const insertResult = await client.query(
      `
      INSERT INTO drive (
        company_id,
        builder_id,
        name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      [
        company_id || null,
        builder_id || null,
        name,
        user_id,
        user_id
      ]
    );

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Drive created successfully"
    );
  } catch (error) {
    console.error("Error creating drive:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.getDrives = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id } = req.user;
    const { page = 1, limit = 25 } = req.query;

    if (!company_id && !builder_id) {
      return errorResponse(res, 400, "User must be associated with either company or builder");
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const countResult = await client.query(
      `
      SELECT COUNT(*) as total
      FROM drive d
      WHERE d.company_id = $1 OR d.builder_id = $2
      `,
      [company_id, builder_id]
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitNum);

    const result = await client.query(
      `
      SELECT 
        d.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM drive d
      LEFT JOIN users u ON u.users_id = d.created_by
      WHERE d.company_id = $1 OR d.builder_id = $2
      ORDER BY d.created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [company_id, builder_id, limitNum, offset]
    );

    const paginationInfo = {
      currentPage: pageNum,
      totalPages: totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
    };

    return successResponse(
      res,
      {
        drives: keysToCamelCase(result.rows),
        pagination: paginationInfo
      },
      "Drives fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching drives:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.getDriveById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { drive_id } = req.params;
    const { company_id, builder_id } = req.user;

    if (!drive_id) {
      return errorResponse(res, 400, "drive_id is required");
    }

    const result = await client.query(
      `
      SELECT 
        d.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM drive d
      LEFT JOIN users u ON u.users_id = d.created_by
      WHERE d.drive_id = $1 AND (d.company_id = $2 OR d.builder_id = $3)
      `,
      [drive_id, company_id, builder_id]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Drive not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Drive fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching drive:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateDrive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { drive_id } = req.params;
    const { name } = req.body;
    const { user_id, company_id, builder_id } = req.user;

    if (!drive_id) {
      return errorResponse(res, 400, "drive_id is required");
    }

    if (!name) {
      return errorResponse(res, 400, "Name is required");
    }

    const checkResult = await client.query(
      `
      SELECT drive_id FROM drive 
      WHERE drive_id = $1 AND (company_id = $2 OR builder_id = $3)
      `,
      [drive_id, company_id, builder_id]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Drive not found or access denied");
    }

    const duplicateCheck = await client.query(
      `
      SELECT drive_id FROM drive 
      WHERE name = $1 AND (company_id = $2 OR builder_id = $3) AND drive_id != $4
      `,
      [name, company_id, builder_id, drive_id]
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 400, "Drive name already exists");
    }

    const updateResult = await client.query(
      `
      UPDATE drive 
      SET name = $1, updated_by = $2, updated_at = NOW()
      WHERE drive_id = $3
      RETURNING *
      `,
      [name, user_id, drive_id]
    );

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Drive updated successfully"
    );
  } catch (error) {
    console.error("Error updating drive:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteDrive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { drive_id } = req.params;
    const { company_id, builder_id } = req.user;

    if (!drive_id) {
      return errorResponse(res, 400, "drive_id is required");
    }

    const checkResult = await client.query(
      `
      SELECT drive_id FROM drive 
      WHERE drive_id = $1 AND (company_id = $2 OR builder_id = $3)
      `,
      [drive_id, company_id, builder_id]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Drive not found or access denied");
    }

    await client.query(
      `
      DELETE FROM drive 
      WHERE drive_id = $1
      `,
      [drive_id]
    );

    return successResponse(
      res,
      null,
      "Drive deleted successfully"
    );
  } catch (error) {
    console.error("Error deleting drive:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};