const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionOption = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  try {
    if (!builderId) {
      return errorResponse(res, 400, "Builder ID not found in user context.");
    }

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    const { option_name } = req.body;

    await client.query("BEGIN");

    const existingOption = await client.query(
      `
        SELECT construction_option_id
        FROM construction_option
        WHERE company_id = $1 AND builder_id = $2 AND option_name = $3
      `,
      [companyId, builderId, option_name.trim()]
    );

    if (existingOption.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Construction option already exists for this company and builder."
      );
    }

    const insertQuery = `
      INSERT INTO construction_option (
        company_id,
        builder_id,
        option_name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      option_name.trim(),
      userId,
      userId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction option created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating construction option:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllConstructionOptions = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context (company_id or builder_id missing)."
      );
    }

    let { page = 1, limit = 10 } = req.query;
    const pageValue = parseInt(page);
    const limitValue = parseInt(limit);
    const offset = (pageValue - 1) * limitValue;

    const params = [companyId, builderId];

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM construction_option
      WHERE company_id = $1 AND builder_id = $2;
    `;

    const countResult = await client.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT *
      FROM construction_option
      WHERE company_id = $1 AND builder_id = $2
      ORDER BY created_at DESC
      LIMIT ${limitValue} OFFSET ${offset};
    `;

    const dataResult = await client.query(dataQuery, params);

    return successResponse(
      res,
      {
        constructionOptions: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Construction options fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching construction options:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteConstructionOption = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!id) {
      return errorResponse(res, 400, "construction_option_id is required");
    }

    if (!builderId || !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context (company_id or builder_id missing)."
      );
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT construction_option_id 
      FROM construction_option
      WHERE construction_option_id = $1
      AND company_id = $2
      AND builder_id = $3;
    `;
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Construction option not found or access denied."
      );
    }

    const deleteQuery = `
      DELETE FROM construction_option
      WHERE construction_option_id = $1;
    `;
    await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Construction option deleted successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete construction option error:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateConstructionOption = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { option_name } = req.body;

    const checkQuery = `
      SELECT * 
      FROM construction_option
      WHERE construction_option_id = $1
        AND company_id = $2
        AND builder_id = $3
      LIMIT 1;
    `;

    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or does not belong to this builder."
      );
    }

    const checkNameQuery = `
      SELECT construction_option_id
      FROM construction_option
      WHERE construction_option_id = $1
        AND company_id = $2
        AND builder_id = $3
        AND option_name != $4
      LIMIT 1;
    `;

    const checkNameResult = await client.query(checkNameQuery, [
      id,
      companyId,
      builderId,
      option_name,
    ]);

    if (checkNameResult.rowCount < 0) {
      return errorResponse(
        res,
        404,
        "constrution option already exist with this option name."
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (option_name !== undefined) {
      fields.push(`option_name = $${i++}`);
      values.push(option_name.trim());
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE construction_option
      SET ${fields.join(", ")}
      WHERE construction_option_id = $${i}
      RETURNING *;
    `;

    values.push(id);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Construction option updated successfully."
    );
  } catch (error) {
    console.error("Error updating construction option:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
