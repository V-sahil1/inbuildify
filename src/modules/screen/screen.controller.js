const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createScreen = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.user_id || req.user?.users_id;
    const { name } = req.body;

    if (!name) {
      return errorResponse(res, 400, "Screen name is required");
    }

    const duplicateCheckQuery = `
      SELECT screen_id
      FROM screen
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1;
    `;

    const duplicateResult = await client.query(duplicateCheckQuery, [name]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        409,
        "Screen with the same name already exists"
      );
    }

    const insertQuery = `
      INSERT INTO screen (
        name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $2)
      RETURNING *;
    `;

    const values = [name, userId];

    const result = await client.query(insertQuery, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Screen created successfully."
    );
  } catch (error) {
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
    const dataQuery = `
      SELECT screen_id, name
      FROM screen
      ORDER BY created_at DESC;
    `;

    const dataResult = await client.query(dataQuery);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
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

    if (!screen_id) {
      return errorResponse(res, 400, "screen_id is required");
    }

    const checkQuery = `
      SELECT screen_id 
      FROM screen
      WHERE screen_id = $1;
    `;
    const checkResult = await client.query(checkQuery, [screen_id]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Screen not found or you are not authorized to delete this screen"
      );
    }

    const deleteQuery = `
      DELETE FROM screen
      WHERE screen_id = $1;
    `;

    await client.query(deleteQuery, [screen_id]);

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
