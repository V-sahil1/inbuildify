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
    // 1️⃣ Determine final sort order
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    // 2️⃣ Get maximum sort order for this builder/company
    const maxSortOrderQuery = `
  SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
  FROM client_type
  WHERE
    (
      (company_id = $1 AND $1 IS NOT NULL)
      OR
      (builder_id = $2 AND $2 IS NOT NULL)
    )
`;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      companyId,
      builderId,
    ]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    // 3️⃣ Validate sort order
    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`
      );
    }

    // 4️⃣ Shift other records' sort_order if needed
    const shiftSortOrderQuery = `
  UPDATE client_type
  SET sort_order = sort_order + 1
  WHERE sort_order >= $1
    AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR
      (builder_id = $3 AND $3 IS NOT NULL)
    )
`;
    await client.query(shiftSortOrderQuery, [
      finalSortOrder,
      companyId,
      builderId,
    ]);

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

    const { client_type, sort_order } = req.body;

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

    const activeRecord = await client.query(
      `
      SELECT client_type, is_active 
      FROM client_type
      WHERE client_type_id = $1
        AND company_id = $2
        AND builder_id = $3
        AND is_active = true
      `,
      [id, companyId, builderId]
    );

    if (activeRecord.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive client type.");
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

    if (sort_order !== undefined && sort_order !== null) {
      // Get the existing sort order
      const existingResult = await client.query(
        `SELECT sort_order FROM client_type WHERE client_type_id = $1`,
        [id]
      );
      const existingSortOrder = existingResult.rows[0].sort_order;

      // Get max sort order
      const maxSortQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM client_type
    WHERE
      (
        (company_id = $1 AND $1 IS NOT NULL)
        OR
        (builder_id = $2 AND $2 IS NOT NULL)
      )
  `;
      const maxSortResult = await client.query(maxSortQuery, [
        companyId,
        builderId,
      ]);
      const maxSortOrder = maxSortResult.rows[0].max_sort_order;

      // Validate new sort order
      if (sort_order < 1 || sort_order > maxSortOrder) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`
        );
      }

      // Shift other records
      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          await client.query(
            `
        UPDATE client_type
        SET sort_order = sort_order - 1
        WHERE sort_order > $1
          AND sort_order <= $2
          AND client_type_id != $3
          AND (
            (company_id = $4 AND $4 IS NOT NULL)
            OR
            (builder_id = $5 AND $5 IS NOT NULL)
          )
        `,
            [existingSortOrder, sort_order, id, companyId, builderId]
          );
        } else {
          await client.query(
            `
        UPDATE client_type
        SET sort_order = sort_order + 1
        WHERE sort_order >= $1
          AND sort_order < $2
          AND client_type_id != $3
          AND (
            (company_id = $4 AND $4 IS NOT NULL)
            OR
            (builder_id = $5 AND $5 IS NOT NULL)
          )
        `,
            [sort_order, existingSortOrder, id, companyId, builderId]
          );
        }
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

exports.updateClientTypeIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { is_active } = req.body;

    if (!id) {
      return errorResponse(res, 400, "client type id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)"
      );
    }

    const existing = await client.query(
      `
      SELECT client_type_id
      FROM client_type
      WHERE client_type_id = $1
        AND builder_id = $2
      `,
      [id, builderId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "client type not found for this builder");
    }

    const updateQuery = `
      UPDATE client_type
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE client_type_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [is_active, userId, id]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "client type status updated successfully."
    );
  } catch (error) {
    console.error("Error updating client type is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
