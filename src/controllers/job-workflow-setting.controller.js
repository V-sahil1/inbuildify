const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobWorkflowSetting = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId || !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `SELECT 1 FROM job_workflow_settings WHERE builder_id = $1 OR company_id = $2`,
      [builderId, companyId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Job workflow settings already exist for this builder."
      );
    }
    const {
      show_all_tasks_to_all_roles,
      include_weekend_date,
      include_holiday_date,
      recalculate_estimated_end_dates_future_tasks,
      recalculate_estimated_dates_based_on_actual_changes,
    } = req.body;

    const insertQuery = `
      INSERT INTO job_workflow_settings (
        company_id,
        builder_id,
        show_all_tasks_to_all_roles,
        include_weekend_date,
        include_holiday_date,
        recalculate_estimated_end_dates_future_tasks,
        recalculate_estimated_dates_based_on_actual_changes,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, 
        $3, $4, $5, 
        $6, $7, $8, $9
      )
      RETURNING 
       *
    `;

    const values = [
      companyId,
      builderId,
      show_all_tasks_to_all_roles ?? false,
      include_weekend_date ?? false,
      include_holiday_date ?? false,
      recalculate_estimated_end_dates_future_tasks ?? false,
      recalculate_estimated_dates_based_on_actual_changes ?? false,
      userId,
      userId,
    ];
    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job workflow settings created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job workflow settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobColorSetting = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const {
      show_all_tasks_to_all_roles,
      include_weekend_date,
      include_holiday_date,
      recalculate_estimated_end_dates_future_tasks,
      recalculate_estimated_dates_based_on_actual_changes,
    } = req.body;

    await client.query("BEGIN");

    const checkRecord = await client.query(
      `SELECT 1 FROM job_workflow_settings WHERE job_workflow_settings_id = $1 AND (builder_id = $2 OR company_id = $3)`,
      [id, builderId, companyId]
    );

    if (checkRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job workflow settings not found for this user."
      );
    }
    const fields = [];
    const values = [];
    let i = 1;

    if (show_all_tasks_to_all_roles !== undefined) {
      fields.push(`show_all_tasks_to_all_roles = $${i++}`);
      values.push(show_all_tasks_to_all_roles);
    }
    if (include_weekend_date !== undefined) {
      fields.push(`include_weekend_date = $${i++}`);
      values.push(include_weekend_date);
    }
    if (include_holiday_date !== undefined) {
      fields.push(`include_holiday_date = $${i++}`);
      values.push(include_holiday_date);
    }
    if (recalculate_estimated_end_dates_future_tasks !== undefined) {
      fields.push(`recalculate_estimated_end_dates_future_tasks = $${i++}`);
      values.push(recalculate_estimated_end_dates_future_tasks);
    }
    if (recalculate_estimated_dates_based_on_actual_changes !== undefined) {
      fields.push(
        `recalculate_estimated_dates_based_on_actual_changes = $${i++}`
      );
      values.push(recalculate_estimated_dates_based_on_actual_changes);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_workflow_settings
      SET ${fields.join(", ")}
      WHERE job_workflow_settings_id = $${i}
      RETURNING 
       *;
    `;

    values.push(id);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job workflow settings updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job workflow settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserJobWorkflowSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT *
      FROM job_workflow_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO job_workflow_settings (
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
      "Job workflow settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching job workflow settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
