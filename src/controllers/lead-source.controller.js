const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createLeadSource = async (req, res) => {
  const { name, sort_order, is_active, allow_change } = req.body || {};

  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.users_id;

  if (!name) {
    return errorResponse(res, 400, "Name is required.");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const existingLeadSourceQuery = `
      SELECT lead_source_id FROM lead_source 
      WHERE LOWER(name) = $1 
        AND (builder_id = $2 OR builder_id IS NULL)
    `;

    const existing = await client.query(existingLeadSourceQuery, [
      name,
      builderId,
    ]);

    if (existing.rows.length > 0) {
      return errorResponse(res, 409, "Lead source already exists.");
    }

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    const maxSortOrderQuery = `
  SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
  FROM lead_source
  WHERE builder_id = $1
`;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      builderId,
    ]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    const shiftSortOrderQuery = `
  UPDATE lead_source
  SET sort_order = sort_order + 1
  WHERE sort_order >= $1
    AND builder_id = $2
`;

    await client.query(shiftSortOrderQuery, [finalSortOrder, builderId]);

    const insertQuery = `
      INSERT INTO lead_source 
      (name, company_id, builder_id, sort_order, is_active, allow_change, created_by, updated_by) 
      VALUES ($1, $2, $3, COALESCE($4, 1), COALESCE($5, true), COALESCE($6, true), $7, $7)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      name,
      companyId,
      builderId,
      finalSortOrder,
      is_active,
      allow_change,
      userId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lead source created successfully.",
    );
  } catch (error) {
    console.error("Create lead source error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Lead source already exists.");
    }

    return errorResponse(res, 500, "Failed to create lead source.");
  } finally {
    client.release();
  }
};

exports.getLeadSources = async (req, res) => {
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM lead_source
      WHERE 
       (builder_id = $1)
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const query = `
      SELECT *
      FROM lead_source 
      WHERE 
      (builder_id = $1)
      ORDER BY sort_order ASC, created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await client.query(query, [builderId, limit, offset]);

    return successResponse(
      res,
      {
        leadSource: keysToCamelCase(result.rows),
        pagination: {
          totalRecords: total,
          curruntPage: page,
          totalPages: totalPages,
          limit,
        },
      },
      "Lead sources retrieved successfully.",
    );
  } catch (error) {
    console.error("Get lead sources error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getLeadSourceById = async (req, res) => {
  const { lead_source_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM lead_source 
      WHERE lead_source_id = $1 AND (builder_id IS NULL OR builder_id = $2)
    `;
    const result = await client.query(query, [lead_source_id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Lead source not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lead source fetched successfully.",
    );
  } catch (error) {
    console.error("Get lead source by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateLeadSource = async (req, res) => {
  const { lead_source_id } = req.params;
  const { name, sort_order, allow_change } = req.body;

  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkQuery = `
      SELECT allow_change, is_active 
      FROM lead_source
      WHERE lead_source_id = $1
        AND (company_id = $2 OR company_id IS NULL)
        AND (builder_id = $3 OR builder_id IS NULL)
    `;
    const checkResult = await client.query(checkQuery, [
      lead_source_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Lead source not found.");
    }

    const checkActiveQuery = `
      SELECT allow_change, is_active 
      FROM lead_source
      WHERE lead_source_id = $1
        AND (company_id = $2 OR company_id IS NULL)
        AND (builder_id = $3 OR builder_id IS NULL)
        AND is_active = true
    `;
    const checkActiveResult = await client.query(checkActiveQuery, [
      lead_source_id,
      companyId,
      builderId,
    ]);

    if (checkActiveResult.rowCount === 0) {
      return errorResponse(res, 404, "Inactive lead source.");
    }

    if (
      name === undefined &&
      sort_order === undefined &&
      allow_change === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update.",
      );
    }

    if (name) {
      const duplicateNameQuery = `
        SELECT 1 FROM lead_source
        WHERE LOWER(name) = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
          AND lead_source_id != $4
      `;
      const duplicateName = await client.query(duplicateNameQuery, [
        name.toLowerCase(),
        companyId,
        builderId,
        lead_source_id,
      ]);

      if (duplicateName.rowCount > 0) {
        return errorResponse(res, 409, "Lead source name already exists.");
      }
    }

    const existingResult = await client.query(
      `
    SELECT sort_order
    FROM lead_source
    WHERE lead_source_id = $1
  `,
      [lead_source_id],
    );

    const existingSortOrder = existingResult.rows[0].sort_order;

    if (sort_order !== undefined && sort_order !== null) {
      const maxSortQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM lead_source
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

      if (sort_order < 1 || sort_order > maxSortOrder) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          await client.query(
            `
          UPDATE lead_source
          SET sort_order = sort_order - 1
          WHERE sort_order > $1
            AND sort_order <= $2
            AND lead_source_id != $3
            AND (
              (company_id = $4 AND $4 IS NOT NULL)
              OR
              (builder_id = $5 AND $5 IS NOT NULL)
            )
        `,
            [
              existingSortOrder,
              sort_order,
              lead_source_id,
              companyId,
              builderId,
            ],
          );
        } else {
          // move up
          await client.query(
            `
          UPDATE lead_source
          SET sort_order = sort_order + 1
          WHERE sort_order >= $1
            AND sort_order < $2
            AND lead_source_id != $3
            AND (
              (company_id = $4 AND $4 IS NOT NULL)
              OR
              (builder_id = $5 AND $5 IS NOT NULL)
            )
        `,
            [
              sort_order,
              existingSortOrder,
              lead_source_id,
              companyId,
              builderId,
            ],
          );
        }
      }
    }

    const updateQuery = `
      UPDATE lead_source
      SET 
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order),
        allow_change = COALESCE($3, allow_change),
        updated_by = $4,
        updated_at = NOW()
      WHERE lead_source_id = $5
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, [
      name,
      sort_order,
      allow_change,
      userId,
      lead_source_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Lead source updated successfully.",
    );
  } catch (error) {
    console.error("Error updating lead source:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteLeadSource = async (req, res) => {
  const { lead_source_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    if (!lead_source_id) {
      return errorResponse(res, 400, "lead source id is required.");
    }
    const existingSource = await client.query(
      `SELECT lead_source_id, sort_order FROM lead_source WHERE lead_source_id = $1 AND builder_id = $2`,
      [lead_source_id, builderId],
    );

    if (existingSource.rowCount === 0) {
      return errorResponse(res, 404, "lead_source not found for this builder.");
    }

    const deletedSortOrder = existingSource.rows[0].sort_order;

    await client.query(`DELETE FROM lead_source WHERE lead_source_id = $1`, [
      lead_source_id,
    ]);

    await client.query(
      `UPDATE lead_source SET sort_order = sort_order - 1 WHERE sort_order > $1 AND builder_id = $2`,
      [deletedSortOrder, builderId],
    );

    return successResponse(res, null, "lead_source deleted successfully.");
  } catch (error) {
    console.error("Error deleting lead source:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateLeadSourceIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { lead_source_id } = req.params;
    const { is_active } = req.body;

    if (!lead_source_id) {
      return errorResponse(res, 400, "lead source id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)",
      );
    }

    const existing = await client.query(
      `
      SELECT lead_source_id
      FROM lead_source
      WHERE lead_source_id = $1
        AND builder_id = $2
      `,
      [lead_source_id, builderId],
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "lead source not found for this builder");
    }

    const updateQuery = `
      UPDATE lead_source
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE lead_source_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      is_active,
      userId,
      lead_source_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "lead source status updated successfully.",
    );
  } catch (error) {
    console.error("Error updating lead source is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
