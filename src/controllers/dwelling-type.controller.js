const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllDwellingTypes = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT dwelling_type_id, builder_id, name, created_at, updated_at FROM dwelling_type WHERE builder_id = $1 AND is_deleted = false ORDER BY dwelling_type;
    `;

    const result = await client.query(query, [req.user.builder_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Dwelling types fetched successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.createDwellingType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const builderId = req.user.builder_id;
  const { name } = req.body;
  try {
    const existsDwellingTypeWithName = await client.query(
      `SELECT * FROM dwelling_type WHERE name = $1 AND builder_id = $2 AND is_deleted = false`,
      [name, builderId]
    );
    if (existsDwellingTypeWithName.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Dwelling type with this name already exists."
      );
    }
    const query = `
      INSERT INTO dwelling_type (name, builder_id)
      VALUES ($1, $2)
      RETURNING dwelling_type_id, builder_id, name, created_at, updated_at;
    `;

    const result = await client.query(query, [name, builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Dwelling type created successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateDwellingType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { dwelling_type_id } = req.params;
  const { name } = req.body;
  const builderId = req.user.builder_id;

  try {
    await client.query("BEGIN");

    const existingDwellingType = await client.query(
      `SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [dwelling_type_id, builderId]
    );

    if (existingDwellingType.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Dwelling type not found.");
    }

    if (existingDwellingType.rows[0].name !== name) {
      const duplicateName = await client.query(
        `SELECT 1 
         FROM dwelling_type 
         WHERE name = $1 AND builder_id = $2 AND dwelling_type_id != $3 AND is_deleted = false`,
        [name, builderId, dwelling_type_id]
      );

      if (duplicateName.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Dwelling type with this name already exists."
        );
      }
    }

    const updateQuery = `
      UPDATE dwelling_type
      SET name = $1, updated_at = NOW()
      WHERE dwelling_type_id = $2 AND builder_id = $3 AND is_deleted = false
      RETURNING dwelling_type_id, builder_id, name, created_at, updated_at;
    `;
    const result = await client.query(updateQuery, [
      name,
      dwelling_type_id,
      builderId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Dwelling type updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteDwellingType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { dwelling_type_id } = req.params;
  const builderId = req.user.builder_id;
  try {
    const checkDwellingTypeExists = await client.query(
      `SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [dwelling_type_id, builderId]
    );
    if (checkDwellingTypeExists.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Dwelling type not found for this builder"
      );
    }

    const query = `UPDATE dwelling_type SET is_deleted = true WHERE dwelling_type_id = $1 AND builder_id = $2 RETURNING dwelling_type_id, builder_id, name, created_at, updated_at;`;
    const result = await client.query(query, [dwelling_type_id, builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Dwelling type deleted successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
