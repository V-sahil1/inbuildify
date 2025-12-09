const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createIntegrationCustomFieldItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const {
      header1_id,
      header2_id,
      value1,
      value2,
      assignee_user_id,
      sort_order = 0,
      is_active = true,
    } = req.body;

    if (!header1_id) {
      return errorResponse(res, 400, "header1_id is required.");
    }
    if (!header2_id) {
      return errorResponse(res, 400, "header2_id is required.");
    }

    await client.query("BEGIN");

    const checkHeader1Query = `
      SELECT integration_custom_field_header_id 
      FROM integration_custom_field_header 
      WHERE integration_custom_field_header_id = $1 
        AND (builder_id = $2 OR company_id = $3);
    `;
    const checkHeader1Result = await client.query(checkHeader1Query, [
      header1_id,
      builderId,
      companyId,
    ]);

    if (checkHeader1Result.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid header1_id: not owned by this builder/company."
      );
    }
    if (header2_id) {
      const checkHeader2Query = `
        SELECT integration_custom_field_header_id 
        FROM integration_custom_field_header 
        WHERE integration_custom_field_header_id = $1 
          AND (builder_id = $2 OR company_id = $3);
      `;
      const checkHeader2Result = await client.query(checkHeader2Query, [
        header2_id,
        builderId,
        companyId,
      ]);

      if (checkHeader2Result.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid header2_id: not owned by this builder/company."
        );
      }
    }

    if (assignee_user_id) {
      const userCheckQuery = `SELECT users_id FROM users WHERE users_id = $1;`;
      const userCheckResult = await client.query(userCheckQuery, [
        assignee_user_id,
      ]);

      if (userCheckResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid assignee_user_id: user not found."
        );
      }
    }

    const sortOrderCheckQuery = `
      SELECT integration_custom_field_item_id
      FROM integration_custom_field_item
      WHERE sort_order = $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    const sortOrderCheckResult = await client.query(sortOrderCheckQuery, [
      sort_order,
      builderId,
      companyId,
    ]);

    if (sortOrderCheckResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Duplicate sort order already exists for this builder/company."
      );
    }

    const insertQuery = `
      INSERT INTO integration_custom_field_item (
        company_id,
        builder_id,
        header1_id,
        header2_id,
        value1,
        value2,
        assignee_user_id,
        sort_order,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      RETURNING *;
    `;

    const insertResult = await client.query(insertQuery, [
      companyId,
      builderId,
      header1_id,
      header2_id,
      value1 || null,
      value2 || null,
      assignee_user_id || null,
      sort_order,
      is_active,
      createdBy,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Integration custom field item created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating integration custom field item:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllIntegrationCustomFieldItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { page = 1, limit = 25 } = req.query;
    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT *
      FROM integration_custom_field_item
      WHERE builder_id = $1
      ORDER BY sort_order ASC
      LIMIT $2 OFFSET $3;
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM integration_custom_field_item
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        items: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Integration custom field items fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching integration custom field items:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.deleteIntegrationCustomFieldItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { integration_custom_field_item_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT integration_custom_field_item_id 
      FROM integration_custom_field_item
      WHERE integration_custom_field_item_id = $1 AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      integration_custom_field_item_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No integration custom field item found for this builder."
      );
    }

    const deleteQuery = `
      DELETE FROM integration_custom_field_item
      WHERE integration_custom_field_item_id = $1 AND builder_id = $2;
    `;
    await client.query(deleteQuery, [
      integration_custom_field_item_id,
      builderId,
    ]);

    return successResponse(
      res,
      null,
      "Integration custom field item deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting integration custom field item:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.updateIntegrationCustomFieldItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { integration_custom_field_item_id } = req.params;
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

    const {
      header1_id,
      header2_id,
      value1,
      value2,
      assignee_user_id,
      sort_order,
      is_active,
    } = req.body;

    const updatingOtherFields =
      header1_id !== undefined ||
      header2_id !== undefined ||
      value1 !== undefined ||
      value2 !== undefined ||
      assignee_user_id !== undefined ||
      sort_order !== undefined;

    const checkItemQuery = `
      SELECT * FROM integration_custom_field_item
      WHERE integration_custom_field_item_id = $1
      AND (builder_id = $2 OR company_id = $3);
    `;
    const checkItemResult = await client.query(checkItemQuery, [
      integration_custom_field_item_id,
      builderId,
      companyId,
    ]);

    if (checkItemResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No integration custom field item found for this user."
      );
    }

    const currentIsActive = checkItemResult.rows[0].is_active;

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (
      header1_id === undefined &&
      header2_id === undefined &&
      value1 === undefined &&
      value2 === undefined &&
      assignee_user_id === undefined &&
      sort_order === undefined &&
      is_active === undefined
    ) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          return errorResponse(
            res,
            403,
            "To deactivate an active custom field item, 'is_active' must be the only field provided in the request."
          );
        }
      }
    }

    if (currentIsActive === false) {
      if (requestedIsActiveTrue) {
        if (updatingOtherFields) {
          return errorResponse(
            res,
            403,
            "To activate an inactive custom field item, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the custom field item is currently inactive. Only 'is_active' can be changed (to true)."
        );
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          return errorResponse(
            res,
            403,
            "Custom field item is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (header1_id) {
      const header1Query = `
        SELECT integration_custom_field_header_id 
        FROM integration_custom_field_header 
        WHERE integration_custom_field_header_id = $1 
        AND (builder_id = $2 OR company_id = $3);
      `;
      const header1Result = await client.query(header1Query, [
        header1_id,
        builderId,
        companyId,
      ]);
      if (header1Result.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid header1_id. It does not belong to this builder or company."
        );
      }
    }

    if (header2_id) {
      const header2Query = `
        SELECT integration_custom_field_header_id 
        FROM integration_custom_field_header 
        WHERE integration_custom_field_header_id = $1 
        AND (builder_id = $2 OR company_id = $3);
      `;
      const header2Result = await client.query(header2Query, [
        header2_id,
        builderId,
        companyId,
      ]);
      if (header2Result.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid header2_id. It does not belong to this builder or company."
        );
      }
    }

    if (assignee_user_id) {
      const userCheckQuery = `
        SELECT users_id FROM users WHERE users_id = $1;
      `;
      const userCheckResult = await client.query(userCheckQuery, [
        assignee_user_id,
      ]);
      if (userCheckResult.rowCount === 0) {
        return errorResponse(res, 400, "Invalid assignee_user_id.");
      }
    }

    if (sort_order !== undefined) {
      const duplicateSortQuery = `
        SELECT integration_custom_field_item_id 
        FROM integration_custom_field_item
        WHERE sort_order = $1 
        AND (builder_id = $2 OR company_id = $3)
        AND integration_custom_field_item_id <> $4;
      `;
      const duplicateSortResult = await client.query(duplicateSortQuery, [
        sort_order,
        builderId,
        companyId,
        integration_custom_field_item_id,
      ]);
      if (duplicateSortResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "Duplicate sort order found. Each item must have a unique sort order."
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (header1_id !== undefined) {
      fields.push(`header1_id = $${i++}`);
      values.push(header1_id);
    }

    if (header2_id !== undefined) {
      fields.push(`header2_id = $${i++}`);
      values.push(header2_id);
    }

    if (value1 !== undefined) {
      fields.push(`value1 = $${i++}`);
      values.push(value1);
    }

    if (value2 !== undefined) {
      fields.push(`value2 = $${i++}`);
      values.push(value2);
    }

    if (assignee_user_id !== undefined) {
      fields.push(`assignee_user_id = $${i++}`);
      values.push(assignee_user_id);
    }

    if (sort_order !== undefined) {
      fields.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }

    if (is_active !== undefined) {
      fields.push(`is_active = $${i++}`);
      values.push(is_active);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE integration_custom_field_item
      SET ${fields.join(", ")}
      WHERE integration_custom_field_item_id = $${i++}
      AND (builder_id = $${i++} OR company_id = $${i})
      RETURNING *;
    `;

    values.push(integration_custom_field_item_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Failed to update record.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Integration custom field item updated successfully."
    );
  } catch (error) {
    console.error("Error updating integration custom field item:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
