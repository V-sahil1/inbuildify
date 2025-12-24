const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createSalesModuleSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const {
      allow_duplicate_leads,
      send_email_on_new_lead,
      show_common_folders,
      lead_mandatory_option,
      role_id,
      sales_won_button_text,
      house_size_unit,
    } = req.body;

    await client.query("BEGIN");

    if (role_id && role_id.length > 0) {
      const checkRoleQuery = `
    SELECT role_id 
    FROM role
    WHERE role_id = ANY($1::uuid[]) AND builder_id = $2
  `;
      const validRoles = await client.query(checkRoleQuery, [
        role_id,
        builderId,
      ]);

      if (validRoles.rows.length !== role_id.length) {
        return errorResponse(
          res,
          400,
          "One or more provided role id are invalid."
        );
      }
    }

    if (role_id && role_id.length > 0) {
      const checkRoleQuery = `
    SELECT role_id 
    FROM role
    WHERE role_id = ANY($1::uuid[]) AND builder_id = $2 AND is_active = true
  `;
      const validRoles = await client.query(checkRoleQuery, [
        role_id,
        builderId,
      ]);

      if (validRoles.rows.length !== role_id.length) {
        return errorResponse(
          res,
          400,
          "One or more provided role id are inactive."
        );
      }
    }

    // Allow only ONE record per builder
    const existingSettings = await client.query(
      `SELECT 1 FROM sales_module_settings 
       WHERE (builder_id = $1) LIMIT 1;`,
      [builderId]
    );

    if (existingSettings.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Sales module settings already exist for this account."
      );
    }

    const insertQuery = `
      INSERT INTO sales_module_settings (
        company_id,
        builder_id,
        allow_duplicate_leads,
        send_email_on_new_lead,
        show_common_folders,
        lead_mandatory_option,
        role_id,
        sales_won_button_text,
        house_size_unit,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9,$10,$11)
      RETURNING *;
    `;
    const values = [
      companyId,
      builderId,
      allow_duplicate_leads ?? false,
      send_email_on_new_lead ?? true,
      show_common_folders ?? true,
      lead_mandatory_option ?? "email_and_phone",
      role_id || [],
      sales_won_button_text || "Mark as Won",
      house_size_unit || "sq_m2",
      userId || null,
      userId || null,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales module settings created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating sales module settings:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getSalesModuleSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 400, "builder_id or company_id is required");
    }

    const query = `
      SELECT * FROM sales_module_settings
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1;
    `;

    const result = await client.query(query, [builderId, companyId]);
    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Sales module settings not found for this user"
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales module settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching sales module settings:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSalesModuleSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { id } = req.params;
    const {
      allow_duplicate_leads,
      send_email_on_new_lead,
      show_common_folders,
      lead_mandatory_option,
      role_id,
      sales_won_button_text,
      house_size_unit,
    } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM sales_module_settings 
       WHERE builder_id = $1 AND sales_module_settings_id = $2
       LIMIT 1;`,
      [builderId, id]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "No sales module settings found for this user."
      );
    }

    if (
      allow_duplicate_leads === undefined &&
      send_email_on_new_lead === undefined &&
      show_common_folders === undefined &&
      lead_mandatory_option === undefined &&
      role_id === undefined &&
      sales_won_button_text === undefined &&
      house_size_unit === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update."
      );
    }

    if (role_id && role_id.length > 0) {
      const checkRoleQuery = `
    SELECT role_id 
    FROM role
    WHERE role_id = ANY($1::uuid[]) AND builder_id = $2
  `;
      const validRoles = await client.query(checkRoleQuery, [
        role_id,
        builderId,
      ]);

      if (validRoles.rows.length !== role_id.length) {
        return errorResponse(
          res,
          400,
          "One or more provided role id are invalid."
        );
      }
    }

    if (role_id && role_id.length > 0) {
      const checkRoleQuery = `
    SELECT role_id 
    FROM role
    WHERE role_id = ANY($1::uuid[]) AND builder_id = $2 AND is_active = true
  `;
      const validRoles = await client.query(checkRoleQuery, [
        role_id,
        builderId,
      ]);

      if (validRoles.rows.length !== role_id.length) {
        return errorResponse(
          res,
          400,
          "One or more provided role id are inactive."
        );
      }
    }

    const updateQuery = `
      UPDATE sales_module_settings
      SET
        allow_duplicate_leads = COALESCE($3, allow_duplicate_leads),
        send_email_on_new_lead = COALESCE($4, send_email_on_new_lead),
        show_common_folders = COALESCE($5, show_common_folders),
        lead_mandatory_option = COALESCE($6, lead_mandatory_option),
        role_id = COALESCE($7::uuid[], role_id),
        sales_won_button_text = COALESCE($8, sales_won_button_text),
        house_size_unit = COALESCE($9, house_size_unit),
        updated_by = $10,
        updated_at = NOW()
      WHERE builder_id = $1 OR company_id = $2
      RETURNING *;
    `;
    const values = [
      builderId,
      companyId,
      allow_duplicate_leads,
      send_email_on_new_lead,
      show_common_folders,
      lead_mandatory_option,
      role_id,
      sales_won_button_text,
      house_size_unit,
      userId,
    ];

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales module settings updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating sales module settings:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getSalesModuleSetting = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    if (!company_id || !builder_id) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let result = await client.query(
      `
      SELECT *
      FROM sales_module_settings
      WHERE company_id = $1 AND builder_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO sales_module_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *;
        `,
        [company_id, builder_id, user_id, user_id]
      );
    }

    return successResponse(
      res,
      {
        salesModuleSettings: keysToCamelCase(result.rows[0]),
      },
      "Sales Module Settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching sales module settings:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
