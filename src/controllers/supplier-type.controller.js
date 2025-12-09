const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createSupplierType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    if (!companyId && !builderId) {
      return errorResponse(res, 401, "Unauthorized: Scope missing.");
    }

    const { name, is_active } = req.body;

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Supplier type name is required.");
    }

    await client.query("BEGIN");

    const checkExisting = await client.query(
      `
      SELECT name
      FROM supplier_type
      WHERE name = $1
        AND builder_id = $2
      LIMIT 1;
    `,
      [name.trim(), builderId]
    );

    if (checkExisting.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Supplier type name already exists for this builder."
      );
    }

    const finalIsActive = is_active ?? true;

    const insertQuery = `
      INSERT INTO supplier_type (
        company_id,
        builder_id,
        name,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      finalIsActive,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier type created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating supplier type:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllSupplierType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Scope missing.");
    }

    let { page = 1, limit = 25, is_active } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const offset = (page - 1) * limit;

    let conditions = [];
    let values = [];
    let index = 1;

    if (companyId) {
      conditions.push(`company_id = $${index++}`);
      values.push(companyId);
    }

    if (builderId) {
      conditions.push(`builder_id = $${index++}`);
      values.push(builderId);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${index++}`);
      values.push(is_active === "true");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const listQuery = `
      SELECT *
      FROM supplier_type
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM supplier_type
      ${whereClause};
    `;

    const [listResult, countResult] = await Promise.all([
      client.query(listQuery, values),
      client.query(countQuery, values),
    ]);

    const rows = keysToCamelCase(listResult.rows);
    const total = parseInt(countResult.rows[0].total, 10);

    const pagination = {
      total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return successResponse(
      res,
      { records: rows, pagination },
      "Supplier types fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching supplier types:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSupplierType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Scope missing.");
    }

    const { supplier_type_id } = req.params;

    if (!supplier_type_id) {
      return errorResponse(res, 400, "Supplier type ID is required.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT 1
      FROM supplier_type
      WHERE supplier_type_id = $1
        AND builder_id = $2
      LIMIT 1;
    `;

    const checkResult = await client.query(checkQuery, [
      supplier_type_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Supplier type not found or access denied."
      );
    }

    const deleteQuery = `
      DELETE FROM supplier_type
      WHERE supplier_type_id = $1;
    `;

    await client.query(deleteQuery, [supplier_type_id]);
    await client.query("COMMIT");

    return successResponse(res, null, "Supplier type deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting supplier type:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSupplierType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { supplier_type_id } = req.params;
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    if (!supplier_type_id) {
      return errorResponse(res, 400, "Supplier type ID is required.");
    }

    const { name, is_active } = req.body;

    if (name === undefined && is_active === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update."
      );
    }

    await client.query("BEGIN");

    const existingSupplier = await client.query(
      `SELECT * FROM supplier_type 
			 WHERE supplier_type_id = $1 AND builder_id = $2`,
      [supplier_type_id, builderId]
    );

    if (existingSupplier.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Supplier type not found for this builder."
      );
    }

    const existing = existingSupplier.rows[0];
    const currentIsActive = existing.is_active;

    const updatingOtherFields = name !== undefined;

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To deactivate an active supplier type, 'is_active' must be the only field provided in the request."
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
            "To activate an inactive supplier type, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        if (is_active === undefined || requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Cannot update non-'is_active' fields when the supplier type is currently inactive. Only 'is_active' can be changed (to true)."
          );
        }
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Supplier type is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (name) {
      const duplicateName = await client.query(
        `SELECT supplier_type_id FROM supplier_type
			 			WHERE LOWER(name) = LOWER($1)
			 			 	AND builder_id = $2
			 			 	AND supplier_type_id != $3`,
        [name.trim(), builderId, supplier_type_id]
      );

      if (duplicateName.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Supplier type name already exists for another record."
        );
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    fields.push(`company_id = $${paramIndex++}`);
    values.push(companyId);

    fields.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
			UPDATE supplier_type
			SET ${fields.join(", ")}
			WHERE supplier_type_id = $${paramIndex} 
			 	AND builder_id = $${paramIndex + 1}
			RETURNING *;
		`;

    values.push(supplier_type_id, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier type updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating supplier type:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
