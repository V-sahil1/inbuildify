const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllDwellingTypes = async (req, res) => {
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
      FROM dwelling_type 
      WHERE builder_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;p
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM dwelling_type
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        dwellingType: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "dwelling type fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching dwelling type:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.createDwellingType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { name, is_active } = req.body;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    if (!name) {
      return errorResponse(res, 400, "Dwelling type name is required.");
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
      SELECT 1 
      FROM dwelling_type 
      WHERE LOWER(name) = LOWER($1)
        AND (builder_id = $2 OR company_id = $3)
      `,
      [name.trim(), builderId, companyId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Dwelling type with this name already exists."
      );
    }

    const insertQuery = `
      INSERT INTO dwelling_type (
        company_id,
        builder_id,
        name,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING dwelling_type_id, company_id, builder_id, name, is_active, created_by, updated_by, created_at, updated_at;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      is_active ?? true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Dwelling type created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating dwelling type:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateDwellingType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { dwelling_type_id } = req.params;
  const { name, is_active } = req.body;
  const builderId = req.user.builder_id;
  const userId = req.user?.user_id;

  const updatingOtherFields = name !== undefined;

  try {
    await client.query("BEGIN");

    const existingDwellingType = await client.query(
      `SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2`,
      [dwelling_type_id, builderId]
    );

    if (existingDwellingType.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Dwelling type not found.");
    }

    const currentIsActive = existingDwellingType.rows[0].is_active;

    if (!name && is_active === undefined) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update."
      );
    }

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To deactivate an active dwelling type, 'is_active' must be the only field provided in the request."
          );
        }
      }
    }

    if (currentIsActive === false) {
      if (requestedIsActiveTrue) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive dwelling type, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the dwelling type is currently inactive. Only 'is_active' can be changed (to true)."
        );
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Dwelling type is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (name) {
      const duplicateName = await client.query(
        `SELECT 1 
          FROM dwelling_type 
          WHERE LOWER(name) = LOWER($1) 
          AND builder_id = $2 
          AND dwelling_type_id != $3`,
        [name.trim(), builderId, dwelling_type_id]
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

    let i = 1;
    const fields = [];
    const values = [];

    if (name) {
      fields.push(`name = $${i++}`);
      values.push(name.trim());
    }

    if (is_active !== undefined) {
      fields.push(`is_active = $${i++}`);
      values.push(is_active);
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
        UPDATE dwelling_type
        SET ${fields.join(", ")}
        WHERE dwelling_type_id = $${i++} AND builder_id = $${i}
        RETURNING *;
    `;

    values.push(dwelling_type_id, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Dwelling type updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating dwelling type:", error);
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
      `SELECT * FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2`,
      [dwelling_type_id, builderId]
    );
    if (checkDwellingTypeExists.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Dwelling type not found for this builder"
      );
    }

    const query = `delete FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2;`;
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
