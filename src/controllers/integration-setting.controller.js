const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createIntegrationSettings = async (req, res) => {
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

    const {
      automatically_send_welcome_email,
      rea_hl_enabled,
      canibuild_enabled,
      website_hl_enabled,
      google_enabled,
      assign_leads_if_assignee_not_found,
      always_assign_leads_to,
    } = req.body;

    const checkQuery = `
      SELECT integration_settings_id 
      FROM integration_settings 
      WHERE (builder_id = $1 OR company_id = $2);
    `;
    const checkResult = await client.query(checkQuery, [builderId, companyId]);

    if (checkResult.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Integration settings already exist for this builder or company."
      );
    }
    const userValidationPromises = [];

    if (assign_leads_if_assignee_not_found) {
      const query = `
        SELECT users_id FROM users 
        WHERE users_id = $1 AND is_deleted = false
      `;
      userValidationPromises.push(
        client.query(query, [assign_leads_if_assignee_not_found])
      );
    }

    if (always_assign_leads_to) {
      const query = `
        SELECT users_id FROM users 
        WHERE users_id = $1 AND is_deleted = false
      `;
      userValidationPromises.push(
        client.query(query, [always_assign_leads_to])
      );
    }

    const validationResults = await Promise.all(userValidationPromises);

    if (
      assign_leads_if_assignee_not_found &&
      validationResults[0]?.rowCount === 0
    ) {
      return errorResponse(
        res,
        400,
        "Invalid user for assign_leads_if_assignee_not_found."
      );
    }

    if (
      always_assign_leads_to &&
      validationResults[validationResults.length - 1]?.rowCount === 0
    ) {
      return errorResponse(
        res,
        400,
        "Invalid user for always_assign_leads_to."
      );
    }

    const insertQuery = `
      INSERT INTO integration_settings (
        company_id,
        builder_id,
        automatically_send_welcome_email,
        rea_hl_enabled,
        canibuild_enabled,
        website_hl_enabled,
        google_enabled,
        assign_leads_if_assignee_not_found,
        always_assign_leads_to,
        created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const insertValues = [
      companyId,
      builderId,
      automatically_send_welcome_email || false,
      rea_hl_enabled || false,
      canibuild_enabled || false,
      website_hl_enabled || false,
      google_enabled || false,
      assign_leads_if_assignee_not_found || null,
      always_assign_leads_to || null,
      userId,
    ];

    const insertResult = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Integration settings created successfully."
    );
  } catch (err) {
    console.error("Error creating integration settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.updateIntegrationSettings = async (req, res) => {
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

    const {
      automatically_send_welcome_email,
      rea_hl_enabled,
      canibuild_enabled,
      website_hl_enabled,
      google_enabled,
      assign_leads_if_assignee_not_found,
      always_assign_leads_to,
    } = req.body;

    const checkQuery = `
      SELECT integration_settings_id
      FROM integration_settings
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1
    `;
    const checkResult = await client.query(checkQuery, [
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Integration settings not found."
      );
    }

    if (assign_leads_if_assignee_not_found) {
      const userCheck = await client.query(
        `SELECT users_id FROM users 
         WHERE users_id = $1 AND is_deleted = false AND is_verified = true`,
        [assign_leads_if_assignee_not_found]
      );

      if (userCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid user for assign_leads_if_assignee_not_found."
        );
      }
    }

    if (always_assign_leads_to) {
      const userCheck = await client.query(
        `SELECT users_id FROM users 
         WHERE users_id = $1 AND is_deleted = false AND is_verified = true`,
        [always_assign_leads_to]
      );

      if (userCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid user for always_assign_leads_to."
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    const addField = (field, value) => {
      fields.push(`${field} = $${i++}`);
      values.push(value);
    };

    if (automatically_send_welcome_email !== undefined)
      addField("automatically_send_welcome_email", automatically_send_welcome_email);

    if (rea_hl_enabled !== undefined)
      addField("rea_hl_enabled", rea_hl_enabled);

    if (canibuild_enabled !== undefined)
      addField("canibuild_enabled", canibuild_enabled);

    if (website_hl_enabled !== undefined)
      addField("website_hl_enabled", website_hl_enabled);

    if (google_enabled !== undefined)
      addField("google_enabled", google_enabled);

    if (assign_leads_if_assignee_not_found !== undefined)
      addField("assign_leads_if_assignee_not_found", assign_leads_if_assignee_not_found);

    if (always_assign_leads_to !== undefined)
      addField("always_assign_leads_to", always_assign_leads_to);

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE integration_settings
      SET ${fields.join(", ")}
      WHERE builder_id = $${i++} OR company_id = $${i}
      RETURNING *;
    `;
    values.push(builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Integration settings updated successfully."
    );
  } catch (err) {
    console.error("Error updating integration settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};


exports.getUserIntegrationSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT *
      FROM integration_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO integration_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        RETURNING *;
        `,
        [company_id, builder_id, user_id]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Integration settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching integration settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
