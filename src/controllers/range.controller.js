const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllRanges = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT range_id, builder_id, name, created_at, updated_at FROM range WHERE builder_id = $1 AND is_deleted = false ORDER BY range;
    `;

    const result = await client.query(query, [req.user.builder_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Ranges fetched successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.createRange = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const builderId = req.user.builder_id;
  const { name } = req.body;
  try {
    const existsRangeWithName = await client.query(
      `SELECT * FROM range WHERE name = $1 AND builder_id = $2 AND is_deleted = false`,
      [name, builderId]
    );
    if (existsRangeWithName.rowCount > 0) {
      return errorResponse(res, 400, "Range with this name already exists.");
    }
    const query = `
      INSERT INTO range (name, builder_id)
      VALUES ($1, $2)
      RETURNING range_id, builder_id, name, created_at, updated_at;
    `;

    const result = await client.query(query, [name, builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Range created successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateRange = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { range_id } = req.params;
  const { name } = req.body;
  const builderId = req.user.builder_id;

  try {
    await client.query("BEGIN");

    const existingRange = await client.query(
      `SELECT * FROM range WHERE range_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [range_id, builderId]
    );

    if (existingRange.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Range not found.");
    }

    if (existingRange.rows[0].name !== name) {
      const duplicateName = await client.query(
        `SELECT 1 FROM range WHERE name = $1 AND builder_id = $2 AND range_id != $3 AND is_deleted = false`,
        [name, builderId, range_id]
      );

      if (duplicateName.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Range with this name already exists.");
      }
    }

    const updateQuery = `
      UPDATE range
      SET name = $1, updated_at = NOW()
      WHERE range_id = $2 AND builder_id = $3 AND is_deleted = false
      RETURNING range_id, builder_id, name, created_at, updated_at;
    `;
    const result = await client.query(updateQuery, [name, range_id, builderId]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Range updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteRange = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { range_id } = req.params;
  const builderId = req.user.builder_id;
  try {
    const checkRangeExists = await client.query(
      `SELECT * FROM range WHERE range_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [range_id, builderId]
    );
    if (checkRangeExists.rowCount === 0) {
      return errorResponse(res, 404, "Range not found for this builder");
    }

    const query = `UPDATE range SET is_deleted = true WHERE range_id = $1 AND builder_id = $2 RETURNING range_id, builder_id, name, created_at, updated_at;`;

    const result = await client.query(query, [range_id, builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Range deleted successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
