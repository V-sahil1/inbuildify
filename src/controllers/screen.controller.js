const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createScreen = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.user_id || req.user?.users_id;
    const builderId = req.user?.builder_id || null;
    const companyId = req.user?.company_id || null;

    const { name } = req.body;

    const insertQuery = `
      INSERT INTO screen (
        company_id,
        builder_id,
        name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $4)
      RETURNING *;
    `;

    const values = [companyId, builderId, name, userId];

    const result = await client.query(insertQuery, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Surveyor created successfully."
    );
  } catch (error) {
    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Screen with same name already exists for this scope"
      );
    }

    console.error("Error creating screen:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getScreens = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;

    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
        *
      FROM screen s
      WHERE s.builder_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM screen
      WHERE builder_id = $1;
    `;

    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        screens: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Screens fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching screens:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteScreen = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { screen_id } = req.params;
    const builderId = req.user.builder_id;

    if (!screen_id) {
      return errorResponse(res, 400, "screen_id is required");
    }

    const checkQuery = `
      SELECT screen_id 
      FROM screen
      WHERE screen_id = $1 AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [screen_id, builderId]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Screen not found or you are not authorized to delete this screen"
      );
    }

    const deleteQuery = `
      DELETE FROM screen
      WHERE screen_id = $1 AND builder_id = $2;
    `;

    await client.query(deleteQuery, [screen_id, builderId]);

    return successResponse(res, {}, "Screen deleted successfully.", 200);
  } catch (error) {
    console.error("Error deleting screen:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateScreen = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { screen_id } = req.params;
    const { name } = req.body;

    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id || req.user?.users_id;

    const checkQuery = `
      SELECT screen_id
      FROM screen
      WHERE screen_id = $1 AND builder_id = $2;
    `;

    const checkResult = await client.query(checkQuery, [screen_id, builderId]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Screen not found or you are not authorized to update this screen"
      );
    }

    const updateQuery = `
      UPDATE screen
      SET 
        name = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE screen_id = $3 AND builder_id = $4
      RETURNING *;
    `;

    const updateValues = [name, userId, screen_id, builderId];

    const result = await client.query(updateQuery, updateValues);

    return successResponse(
      res,
      result.rows[0],
      "Screen updated successfully.",
      200
    );
  } catch (error) {
    console.error("Error updating screen:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Screen with this name already exists for this builder/company."
      );
    }

    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllScreens = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id; // may be null
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
       *
      FROM screen
      WHERE 
        (
        
          (builder_id = $1)
        )
      ORDER BY name
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM screen
      WHERE 
        (
          (builder_id = $1)
        );
    `;

    const countResult = await client.query(countQuery, [builderId]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        screens: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Screens fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching screens:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
