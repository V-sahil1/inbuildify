const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createIntegrationCustomFieldHeader = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const { header_name } = req.body;

    if (!header_name || header_name.trim() === "") {
      return errorResponse(res, 400, "Header name is required.");
    }

    const nameCheckQuery = `
      SELECT integration_custom_field_header_id
      FROM integration_custom_field_header
      WHERE LOWER(header_name) = LOWER($1)
      AND (builder_id = $2 OR company_id = $3);
    `;
    const nameCheck = await client.query(nameCheckQuery, [
      header_name.trim(),
      builderId,
      companyId,
    ]);

    if (nameCheck.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "A header with this name already exists for this builder or company."
      );
    }

    const insertQuery = `
      INSERT INTO integration_custom_field_header (
        company_id,
        builder_id,
        header_name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const insertValues = [
      companyId,
      builderId,
      header_name.trim(),
      userId,
      userId,
    ];

    const insertResult = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Integration custom field header created successfully."
    );
  } catch (err) {
    console.error("Error creating integration custom field header:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllIntegrationCustomFieldHeader = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { page = 1, limit = 25 } = req.query;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
        *
      FROM integration_custom_field_header
      WHERE (builder_id = $1 OR company_id = $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4;
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      companyId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM integration_custom_field_header
      WHERE (builder_id = $1 OR company_id = $2);
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        integrationCustomFieldHeaders: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Integration custom field headers fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching integration custom field headers:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteIntegrationCustomFieldHeader = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { integration_custom_field_header_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const checkQuery = `
      SELECT integration_custom_field_header_id 
      FROM integration_custom_field_header
      WHERE integration_custom_field_header_id = $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      integration_custom_field_header_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No integration custom field header found for this builder."
      );
    }

    const deleteQuery = `
      DELETE FROM integration_custom_field_header
      WHERE integration_custom_field_header_id = $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    await client.query(deleteQuery, [
      integration_custom_field_header_id,
      builderId,
      companyId,
    ]);

    return successResponse(
      res,
      null,
      "Integration custom field header deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting integration custom field header:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.updateIntegrationCustomFieldHeader = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { integration_custom_field_header_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const { header_name } = req.body;

    const checkQuery = `
      SELECT * FROM integration_custom_field_header
      WHERE integration_custom_field_header_id = $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      integration_custom_field_header_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or not owned by this builder."
      );
    }


    if (header_name) {
      const duplicateNameQuery = `
        SELECT integration_custom_field_header_id
        FROM integration_custom_field_header
        WHERE LOWER(header_name) = LOWER($1)
          AND (builder_id = $2 OR company_id = $3)
          AND integration_custom_field_header_id <> $4;
      `;
      const duplicateNameResult = await client.query(duplicateNameQuery, [
        header_name.trim(),
        builderId,
        companyId,
        integration_custom_field_header_id,
      ]);

      if (duplicateNameResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "Header name already exists for this builder/company."
        );
      }
    }


    const fields = [];
    const values = [];
    let i = 1;

    if (header_name !== undefined) {
      fields.push(`header_name = $${i++}`);
      values.push(header_name.trim());
    }


    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE integration_custom_field_header
      SET ${fields.join(", ")}
      WHERE integration_custom_field_header_id = $${i++}
        AND (builder_id = $${i++} OR company_id = $${i})
      RETURNING *;
    `;

    values.push(integration_custom_field_header_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Failed to update record.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Integration custom field header updated successfully."
    );
  } catch (error) {
    console.error("Error updating integration custom field header:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

