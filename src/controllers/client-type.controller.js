const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createClientType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { client_type, sort_order, is_active } = req.body;

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
      SELECT client_type_id 
      FROM client_type 
      WHERE builder_id = $1
        AND LOWER(client_type) = LOWER($2)
      `,
      [builderId, client_type]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "client type already exists.");
    }
    const finalSortOrder = sort_order ?? 1;

    const checkSortOrder = await client.query(
      `SELECT 1 
       FROM client_type
       WHERE sort_order = $1
       AND builder_id = $2
     `,
      [finalSortOrder, builderId]
    );

    if (checkSortOrder.rowCount > 0) {
      return errorResponse(
        res,
        409,
        `Sort order ${finalSortOrder} already exists for this builder.`
      );
    }

    const insertQuery = `
      INSERT INTO client_type (
        company_id,
        builder_id,
        client_type,
        sort_order,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      client_type,
      sort_order || 1,
      is_active ?? true,
      userId,
      userId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "client type created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating client type:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllClientType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    let { page = 1, limit = 25 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `
        SELECT COUNT(*) AS total
        FROM client_type
        WHERE company_id = $1 AND builder_id = $2
      `,
      [companyId, builderId]
    );

    const total = parseInt(countResult.rows[0].total);
    const result = await client.query(
      `
        SELECT 
         *
        FROM client_type
        WHERE company_id = $1 AND builder_id = $2
        ORDER BY sort_order ASC
        LIMIT $3 OFFSET $4
      `,
      [companyId, builderId, limit, offset]
    );

    return successResponse(res, {
      clientType: keysToCamelCase(result.rows),
      totalRecord: total,
      curruntPage: page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error("Error fetching client type:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteClientType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, " ID is required.");
    }
    const existingClient = await client.query(
      `SELECT client_type FROM client_type WHERE client_type_id = $1 AND builder_id = $2`,
      [id, builderId]
    );

    if (existingClient.rowCount === 0) {
      return errorResponse(res, 404, "client type not found for this builder.");
    }

    await client.query(`DELETE FROM client_type WHERE client_type_id = $1`, [
      id,
    ]);

    return successResponse(res, null, "client type deleted successfully.");
  } catch (error) {
    console.error("Error deleting surveyor:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateClientType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { client_type, sort_order, is_active } = req.body;

    const updatingOtherFields = client_type || sort_order !== undefined;

    await client.query("BEGIN");

    const record = await client.query(
      `
      SELECT client_type, is_active 
      FROM client_type
      WHERE client_type_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [id, companyId, builderId]
    );

    if (record.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "client type Record not found.");
    }

    const currentIsActive = record.rows[0].is_active;

    if (!client_type && sort_order === undefined && is_active === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update."
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
            "To deactivate an active client type, 'is_active' must be the only field provided in the request."
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
            "To activate an inactive client type, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the client type is currently inactive. Only 'is_active' can be changed (to true)."
        );
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Client type is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (client_type) {
      const dupCheck = await client.query(
        `
        SELECT client_type_id 
        FROM client_type
        WHERE (company_id = $1 AND builder_id = $2)
          AND LOWER(client_type) = LOWER($3)
          AND client_type_id <> $4
        `,
        [companyId, builderId, client_type, id]
      );

      if (dupCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "client type already exists.");
      }
    }

    if (sort_order !== undefined) {
      const duplicateSortQuery = `
        SELECT 1 FROM client_type
        WHERE sort_order = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
          AND client_type_id != $4
      `;
      const duplicateSort = await client.query(duplicateSortQuery, [
        sort_order,
        companyId,
        builderId,
        id,
      ]);

      if (duplicateSort.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          `Sort order ${sort_order} already exists.`
        );
      }
    }
    const updates = [];
    const values = [];
    let idx = 1;

    if (client_type) {
      updates.push(`client_type = $${idx++}`);
      values.push(client_type);
    }

    if (sort_order !== undefined) {
      updates.push(`sort_order = $${idx++}`);
      values.push(sort_order);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);
    }
    updates.push(`updated_by = $${idx++}`);
    values.push(userId);

    updates.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE client_type
      SET ${updates.join(", ")}
      WHERE client_type_id = $${idx}
        AND company_id = $${idx + 1}
        AND builder_id = $${idx + 2}
      RETURNING *;
    `;

    values.push(id, companyId, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "client type updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating client type:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
