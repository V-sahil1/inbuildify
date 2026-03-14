const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createJobSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `SELECT 1 FROM job_settings WHERE builder_id = $1 OR company_id = $2`,
      [builderId, companyId],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Job settings already exist for this builder/company.",
      );
    }

    const {
      auto_move_to_maintenance,
      auto_mark_completed,
      auto_archive_after_completion,
      auto_archive_after_days,
      milestone_status_check_days,
      report_custom_days,
      report_status_filter,
      report_include_date,
    } = req.body;

    if (
      (auto_archive_after_completion === false && auto_archive_after_days) ||
      (auto_archive_after_completion === undefined && auto_archive_after_days)
    ) {
      return errorResponse(
        res,
        400,
        "You cannot set auto_archive_after_days when auto_archive_after_completion is FALSE.",
      );
    }

    const insertQuery = `
      INSERT INTO job_settings (
        company_id,
        builder_id,
        auto_move_to_maintenance,
        auto_mark_completed,
        auto_archive_after_completion,
        auto_archive_after_days,
        milestone_status_check_days,
        report_custom_days,
        report_status_filter,
        report_include_date,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, 
        $3, $4, $5, 
        $6, $7, $8, 
        $9, $10, 
        $11, $12
      )
      RETURNING 
       *
    `;
    const values = [
      companyId,
      builderId,
      auto_move_to_maintenance ?? false,
      auto_mark_completed ?? false,
      auto_archive_after_completion ?? false,
      auto_archive_after_days || null,
      milestone_status_check_days || null,
      report_custom_days || null,
      report_status_filter || "all",
      report_include_date ?? true,
      userId,
      userId,
    ];
    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job settings created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    const {
      auto_move_to_maintenance,
      auto_mark_completed,
      auto_archive_after_completion,
      auto_archive_after_days,
      milestone_status_check_days,
      report_custom_days,
      report_status_filter,
      report_include_date,
    } = req.body;

    await client.query("BEGIN");

    const checkRecord = await client.query(
      `
      SELECT auto_archive_after_completion, auto_archive_after_days
      FROM job_settings
      WHERE builder_id = $1 OR company_id = $2
      `,
      [builderId, companyId],
    );

    if (checkRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Job settings not found for this user.");
    }

    const existing = checkRecord.rows[0];

    if (auto_archive_after_completion === true) {
      const otherFields = ["auto_archive_after_days"];
      const isOtherFieldProvided = otherFields.some(
        (field) => req.body[field] !== undefined,
      );
    }

    if (
      auto_archive_after_completion === false &&
      auto_archive_after_days !== undefined
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "auto_archive_after_days cannot be updated when auto_archive_after_completion is false.",
      );
    }

    let forceNullDays = false;

    if (
      existing.auto_archive_after_completion === true &&
      auto_archive_after_completion === false
    ) {
      forceNullDays = true;
    }

    if (
      existing.auto_archive_after_completion === false &&
      auto_archive_after_completion !== true &&
      auto_archive_after_days !== undefined
    ) {
      return errorResponse(
        res,
        400,
        "auto_archive_after_days cannot be updated when auto_archive_after_completion is false.",
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (auto_move_to_maintenance !== undefined) {
      fields.push(`auto_move_to_maintenance = $${i++}`);
      values.push(auto_move_to_maintenance);
    }

    if (auto_mark_completed !== undefined) {
      fields.push(`auto_mark_completed = $${i++}`);
      values.push(auto_mark_completed);
    }

    if (auto_archive_after_completion !== undefined) {
      fields.push(`auto_archive_after_completion = $${i++}`);
      values.push(auto_archive_after_completion);
    }

    if (auto_archive_after_days !== undefined) {
      fields.push(`auto_archive_after_days = $${i++}`);
      values.push(auto_archive_after_days);
    }

    if (forceNullDays) {
      fields.push(`auto_archive_after_days = NULL`);
    }

    if (milestone_status_check_days !== undefined) {
      fields.push(`milestone_status_check_days = $${i++}`);
      values.push(milestone_status_check_days);
    }

    if (report_custom_days !== undefined) {
      fields.push(`report_custom_days = $${i++}`);
      values.push(report_custom_days);
    }

    if (report_status_filter !== undefined) {
      fields.push(`report_status_filter = $${i++}`);
      values.push(report_status_filter);
    }

    if (report_include_date !== undefined) {
      fields.push(`report_include_date = $${i++}`);
      values.push(report_include_date);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_settings
      SET ${fields.join(", ")}
      WHERE builder_id = $${i} OR company_id = $${i + 1}
      RETURNING auto_move_to_maintenance, auto_mark_completed, auto_archive_after_completion, auto_archive_after_days, milestone_status_check_days, report_custom_days, report_status_filter, report_include_date;
    `;

    values.push(builderId, companyId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job settings updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserJobSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT auto_move_to_maintenance, auto_mark_completed, auto_archive_after_completion,
       auto_archive_after_days, milestone_status_check_days, report_custom_days, 
       report_status_filter, report_include_date
      FROM job_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO job_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        RETURNING auto_move_to_maintenance, auto_mark_completed, auto_archive_after_completion, auto_archive_after_days, milestone_status_check_days, report_custom_days, report_status_filter, report_include_date;;
        `,
        [company_id, builder_id, user_id],
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job settings fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching job settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
