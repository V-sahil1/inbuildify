const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const getPool = require("../../config/database");

exports.createMaintenanceSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const createdBy = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const {
      area_enabled,
      supplier_enabled,
      allow_completion_without_supplier_response,
      request_date_enabled,
      task_date_enabled,
      repair_cost_enabled,
      hours_spent_enabled,
      maintenance_start_date,
      handover_date,
      maintenance_period_days,
      maintenance_duration_days,
      supervisor_roles,
    } = req.body;

    if (!supplier_enabled && allow_completion_without_supplier_response) {
      return errorResponse(
        res,
        400,
        "Cannot allow completion without supplier response when supplier is disabled."
      );
    }

    await client.query("BEGIN");

    if (Array.isArray(supervisor_roles) && supervisor_roles.length > 0) {
      const roleCheckQuery = `
        SELECT role_id FROM role
        WHERE role_id = ANY($1::uuid[]) AND (builder_id = $2 OR builder_id IS NULL);
      `;
      const roleCheckResult = await client.query(roleCheckQuery, [
        supervisor_roles,
        builderId,
      ]);

      if (roleCheckResult.rows.length !== supervisor_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more supervisor_roles are invalid for this builder."
        );
      }
    }

    if (Array.isArray(supervisor_roles) && supervisor_roles.length > 0) {
      const roleCheckQuery = `
        SELECT role_id FROM role
        WHERE role_id = ANY($1::uuid[]) AND (builder_id = $2 OR builder_id IS NULL) AND is_active = true
      `;
      const roleCheckResult = await client.query(roleCheckQuery, [
        supervisor_roles,
        builderId,
      ]);

      if (roleCheckResult.rows.length !== supervisor_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more supervisor_roles are inactive."
        );
      }
    }

    const existingCheckQuery = `
      SELECT maintenance_settings_id
      FROM maintenance_settings
      WHERE company_id = $1 AND builder_id = $2;
    `;
    const existingCheckResult = await client.query(existingCheckQuery, [
      companyId,
      builderId,
    ]);
    if (existingCheckResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Maintenance settings already exist for this company and builder."
      );
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (maintenance_start_date && !isValidDate(maintenance_start_date)) {
      return errorResponse(res, 400, `Invalid date: ${maintenance_start_date}`);
    }

    if (handover_date && !isValidDate(handover_date)) {
      return errorResponse(res, 400, `Invalid date: ${handover_date}`);
    }

    const insertQuery = `
      INSERT INTO maintenance_settings (
        company_id, builder_id,
        area_enabled, supplier_enabled,
        allow_completion_without_supplier_response,
        request_date_enabled, task_date_enabled,
        repair_cost_enabled, hours_spent_enabled,
        maintenance_start_date, handover_date,
        maintenance_period_days, maintenance_duration_days,
        supervisor_roles, created_by, updated_by
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13,
        $14, $15, $15
      )
      RETURNING *;
    `;
    const values = [
      companyId,
      builderId,
      area_enabled ?? false,
      supplier_enabled ?? false,
      allow_completion_without_supplier_response ?? false,
      request_date_enabled ?? false,
      task_date_enabled ?? false,
      repair_cost_enabled ?? false,
      hours_spent_enabled ?? false,
      maintenance_start_date,
      handover_date,
      maintenance_period_days,
      maintenance_duration_days,
      supervisor_roles,
      createdBy,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    const data = keysToCamelCase(result.rows[0]);
    return successResponse(
      res,
      data,
      "Maintenance settings created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating maintenance settings:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updateMaintenanceSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const {
      area_enabled,
      supplier_enabled,
      allow_completion_without_supplier_response,
      request_date_enabled,
      task_date_enabled,
      repair_cost_enabled,
      hours_spent_enabled,
      maintenance_start_date,
      maintenance_period_days,
      maintenance_duration_days,
      supervisor_roles,
    } = req.body;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Builder or Company ID missing."
      );
    }

    await client.query("BEGIN");

    const existingResult = await client.query(
      `
      SELECT *
      FROM maintenance_settings
      WHERE builder_id = $1 AND company_id = $2
      `,
      [builderId, companyId]
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Maintenance settings not found.");
    }

    const currentSettings = existingResult.rows[0];

    if (
      maintenance_start_date !== undefined &&
      !["handover_date", "occupancy_permit_date"].includes(
        maintenance_start_date
      )
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "maintenance_start_date must be 'handover_date' or 'occupancy_permit_date'."
      );
    }

    if (
      currentSettings.supplier_enabled === false &&
      allow_completion_without_supplier_response !== undefined
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot update allow_completion because supplier is disabled."
      );
    }

    if (
      supplier_enabled === false &&
      allow_completion_without_supplier_response === true
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot allow completion without supplier response when supplier is disabled."
      );
    }

    let finalAllowCompletion = allow_completion_without_supplier_response;
    if (supplier_enabled === false) {
      finalAllowCompletion = false;
    }

    if (Array.isArray(supervisor_roles) && supervisor_roles.length > 0) {
      const roleCheck = await client.query(
        `
        SELECT role_id
        FROM role
        WHERE role_id = ANY($1::uuid[])
        `,
        [supervisor_roles]
      );

      if (roleCheck.rowCount !== supervisor_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more supervisor_roles are invalid."
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (area_enabled !== undefined) {
      fields.push(`area_enabled = $${i++}`);
      values.push(area_enabled);
    }
    if (supplier_enabled !== undefined) {
      fields.push(`supplier_enabled = $${i++}`);
      values.push(supplier_enabled);
    }
    if (finalAllowCompletion !== undefined) {
      fields.push(`allow_completion_without_supplier_response = $${i++}`);
      values.push(finalAllowCompletion);
    }
    if (request_date_enabled !== undefined) {
      fields.push(`request_date_enabled = $${i++}`);
      values.push(request_date_enabled);
    }
    if (task_date_enabled !== undefined) {
      fields.push(`task_date_enabled = $${i++}`);
      values.push(task_date_enabled);
    }
    if (repair_cost_enabled !== undefined) {
      fields.push(`repair_cost_enabled = $${i++}`);
      values.push(repair_cost_enabled);
    }
    if (hours_spent_enabled !== undefined) {
      fields.push(`hours_spent_enabled = $${i++}`);
      values.push(hours_spent_enabled);
    }
    if (maintenance_start_date !== undefined) {
      fields.push(`maintenance_start_date = $${i++}`);
      values.push(maintenance_start_date);
    }
    if (maintenance_period_days !== undefined) {
      fields.push(`maintenance_period_days = $${i++}`);
      values.push(maintenance_period_days);
    }
    if (maintenance_duration_days !== undefined) {
      fields.push(`maintenance_duration_days = $${i++}`);
      values.push(maintenance_duration_days);
    }
    if (supervisor_roles !== undefined) {
      fields.push(`supervisor_roles = $${i++}`);
      values.push(supervisor_roles);
    }

    if (!fields.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    values.push(builderId, companyId);

    const updateResult = await client.query(
      `
      UPDATE maintenance_settings
      SET ${fields.join(", ")}
      WHERE builder_id = $${i} AND company_id = $${i + 1}
      RETURNING *;
      `,
      values
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Maintenance settings updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating maintenance settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getUserMaintenanceSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT *
      FROM maintenance_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO maintenance_settings (
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
      "Maintenance settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching maintenance settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
