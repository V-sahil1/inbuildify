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

    const finalSortOrder = sort_order ?? 1;

    const checkSortOrder = await client.query(
      `SELECT 1 
   FROM lead_source
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
      INSERT INTO lead_source 
      (name, company_id, builder_id, sort_order, is_active, allow_change, created_by, updated_by) 
      VALUES ($1, $2, $3, COALESCE($4, 1), COALESCE($5, true), COALESCE($6, true), $7, $7)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      name,
      companyId,
      builderId,
      sort_order,
      is_active,
      allow_change,
      userId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lead source created successfully."
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
      WHERE (company_id = $1 OR company_id IS NULL)
        AND (builder_id = $2 OR builder_id IS NULL)
    `;
    const countResult = await client.query(countQuery, [companyId, builderId]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const query = `
      SELECT *
      FROM lead_source 
      WHERE (company_id = $1 OR company_id IS NULL)
      AND (builder_id = $2 OR builder_id IS NULL)
      ORDER BY sort_order ASC, created_at DESC
      LIMIT $3 OFFSET $4;
    `;
    const result = await client.query(query, [
      companyId,
      builderId,
      limit,
      offset,
    ]);

    return successResponse(
      res,
      {
        leadSource: keysToCamelCase(result.rows),
        pagination: {
          totalRecord: total,
          curruntPage: page,
          totalPage: totalPages,
          limit,
        },
      },
      "Lead sources retrieved successfully."
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
      "Lead source fetched successfully."
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
  const { name, sort_order, is_active, allow_change } = req.body;

  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const updatingOtherFields =
      name || sort_order !== undefined || allow_change !== undefined;

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

    if (!name && !sort_order && is_active === undefined && !allow_change) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update."
      );
    }

    const currentAllowChange = checkResult.rows[0].allow_change;
    const currentIsActive = checkResult.rows[0].is_active;

    if (!currentAllowChange) {
      return errorResponse(res, 403, "This lead source cannot be modified.");
    }

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (currentIsActive === true && requestedIsActiveFalse) {
      if (updatingOtherFields) {
        return errorResponse(
          res,
          403,
          "To deactivate an active lead source, 'is_active' must be the only field provided in the request."
        );
      }
    }

    if (currentIsActive === false) {
      if (requestedIsActiveTrue) {
        if (updatingOtherFields) {
          return errorResponse(
            res,
            403,
            "To activate an inactive lead source, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the lead source is currently inactive."
        );
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          return errorResponse(
            res,
            403,
            "Lead source is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
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

    if (sort_order !== undefined) {
      const duplicateSortQuery = `
        SELECT 1 FROM lead_source
        WHERE sort_order = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND (builder_id = $3 OR builder_id IS NULL)
          AND lead_source_id != $4
      `;
      const duplicateSort = await client.query(duplicateSortQuery, [
        sort_order,
        companyId,
        builderId,
        lead_source_id,
      ]);

      if (duplicateSort.rowCount > 0) {
        return errorResponse(
          res,
          409,
          `Sort order ${sort_order} already exists.`
        );
      }
    }

    const updateQuery = `
      UPDATE lead_source
      SET 
        name = COALESCE($1, name),
        sort_order = COALESCE($2, sort_order),
        is_active = COALESCE($3, is_active),
        allow_change = COALESCE($4, allow_change),
        updated_by = $5,
        updated_at = NOW()
      WHERE lead_source_id = $6
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, [
      name,
      sort_order,
      is_active,
      allow_change,
      userId,
      lead_source_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Lead source updated successfully."
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
      `SELECT lead_source_id FROM lead_source WHERE lead_source_id = $1 AND builder_id = $2`,
      [lead_source_id, builderId]
    );

    if (existingSource.rowCount === 0) {
      return errorResponse(res, 404, "lead_source not found for this builder.");
    }

    await client.query(`DELETE FROM lead_source WHERE lead_source_id = $1`, [
      lead_source_id,
    ]);

    return successResponse(res, null, "lead_source deleted successfully.");
  } catch (error) {
    console.error("Error deleting lead source:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
