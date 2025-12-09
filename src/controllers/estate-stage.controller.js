const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createEstateStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_id, name, release_date } = req.body;
    const builderId = req.user?.builder_id;

    const estateCheck = await client.query(
      `SELECT estate_id 
       FROM estate 
       WHERE estate_id = $1 AND builder_id = $2`,
      [estate_id, builderId]
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Estate not found or you do not have permission."
      );
    }

    const estateActiveCheck = await client.query(
      `SELECT estate_id 
       FROM estate 
       WHERE estate_id = $1 AND builder_id = $2 AND status = 'true'`,
      [estate_id, builderId]
    );

    if (estateActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive Estate.");
    }

    const dupCheck = await client.query(
      `SELECT estate_stage_id
       FROM estate_stages
       WHERE estate_id = $1 AND LOWER(name) = LOWER($2)`,
      [estate_id, name]
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Stage name already exists for this estate."
      );
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (release_date && !isValidDate(release_date)) {
      return errorResponse(res, 400, `Invalid date: ${release_date}`);
    }

    const result = await client.query(
      `INSERT INTO estate_stages 
        (estate_id, name, release_date)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [estate_id, name, release_date || null]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Estate stage created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create estate stage error:", err);
    return errorResponse(res, 500, "Failed to create estate stage.");
  } finally {
    client.release();
  }
};

exports.getAllEstateStages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    const { page = 1, limit = 25 } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const countResult = await client.query(
      `SELECT COUNT(es.estate_stage_id) AS total
       FROM estate_stages es
       JOIN estate e ON e.estate_id = es.estate_id
       WHERE e.builder_id = $1`,
      [builderId]
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNumber);

    const result = await client.query(
      `SELECT es.*
       FROM estate_stages es
       JOIN estate e ON e.estate_id = es.estate_id
       WHERE e.builder_id = $1
       ORDER BY es.created_at DESC
       LIMIT $2 OFFSET $3`,
      [builderId, limitNumber, offset]
    );

    return successResponse(res, {
      estateStage: keysToCamelCase(result.rows),
      records: total,
      currentPage: pageNumber,
      limit: limitNumber,
      totalPages,
    });
  } catch (err) {
    console.error("Get all estate stages error:", err);
    return errorResponse(res, 500, "Failed to fetch estate stages.");
  } finally {
    client.release();
  }
};

exports.deleteEstateStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_stage_id } = req.params;
    const builderId = req.user?.builder_id;

    const stageCheck = await client.query(
      `SELECT estate_id 
       FROM estate_stages
       WHERE estate_stage_id = $1`,
      [estate_stage_id]
    );

    if (stageCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate stage not found.");
    }

    const estateId = stageCheck.rows[0].estate_id;

    const estateCheck = await client.query(
      `SELECT estate_id
       FROM estate
       WHERE estate_id = $1 AND builder_id = $2`,
      [estateId, builderId]
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not allowed to delete stages from this estate."
      );
    }

    await client.query(
      `DELETE FROM estate_stages
       WHERE estate_stage_id = $1`,
      [estate_stage_id]
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Estate stage deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete estate stage error:", err);
    return errorResponse(res, 500, "Failed to delete estate stage.");
  } finally {
    client.release();
  }
};

exports.updateEstateStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { estate_stage_id } = req.params;
    const { name, release_date } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT estate_id, name FROM estate_stages WHERE estate_stage_id = $1`,
      [estate_stage_id]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate stage not found");
    }

    const estateId = existing.rows[0].estate_id;
    const oldName = existing.rows[0].name;

    const estateCheck = await client.query(
      `SELECT estate_id FROM estate WHERE estate_id = $1 AND builder_id = $2`,
      [estateId, builderId]
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate not found");
    }

    const estateActiveCheck = await client.query(
      `SELECT estate_id FROM estate WHERE estate_id = $1 AND builder_id = $2 ANd status = 'true'`,
      [estateId, builderId]
    );

    if (estateActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive estate");
    }

    if (name && name !== oldName) {
      const dupCheck = await client.query(
        `SELECT 1 FROM estate_stages 
         WHERE estate_id = $1 AND name = $2 AND estate_stage_id != $3`,
        [estateId, name, estate_stage_id]
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Stage name already exists for this estate"
        );
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (release_date && !isValidDate(release_date)) {
      return errorResponse(res, 400, `Invalid date: ${release_date}`);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (release_date) {
      fields.push(`release_date = $${idx++}`);
      values.push(release_date);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Nothing to update");
    }

    fields.push(`updated_at = NOW()`);

    const query = `
      UPDATE estate_stages
      SET ${fields.join(", ")}
      WHERE estate_stage_id = $${idx}
      RETURNING *;
    `;
    values.push(estate_stage_id);

    const updated = await client.query(query, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Estate stage updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating estate stage:", error);
    return errorResponse(res, 500, "Something went wrong");
  } finally {
    client.release();
  }
};
