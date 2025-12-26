const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobInvoiceStagePayment = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { description, percentage, sort_order, active } = req.body;

    if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
      return errorResponse(res, 400, "Percentage must be between 0 and 100.");
    }
    await client.query("BEGIN");

    const settingsQuery = `
      SELECT job_invoice_settings_id
      FROM job_invoice_settings
      WHERE builder_id = $1
      LIMIT 1;
    `;
    const settingsResult = await client.query(settingsQuery, [builderId]);

    if (settingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job invoice settings not found for this builder."
      );
    }

    const jobInvoiceSettingsId = settingsResult.rows[0].job_invoice_settings_id;

    const sortCheck = await client.query(
      `SELECT 1 FROM job_invoice_stage_payments 
       WHERE job_invoice_settings_id = $1 AND sort_order = $2`,
      [jobInvoiceSettingsId, sort_order || 1]
    );

    if (sortCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order ${sort_order || 1} already exists.`
      );
    }
    const insertQuery = `
      INSERT INTO job_invoice_stage_payments (
        job_invoice_settings_id,
        description,
        percentage,
        sort_order,
        active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING job_invoice_stage_payment_id, job_invoice_settings_id, description, percentage, sort_order, active, created_at, updated_at;
    `;

    const values = [
      jobInvoiceSettingsId,
      description.trim(),
      percentage || 0,
      sort_order || 1,
      active ?? true,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job invoice stage payment created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job invoice stage payment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllJobInvoiceStagePayments = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { page = 1, limit = 25 } = req.query;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
        jsp.job_invoice_stage_payment_id,
        jsp.job_invoice_settings_id,
        jsp.description,
        jsp.percentage,
        jsp.sort_order,
        jsp.active,
        jsp.created_at,
        jsp.updated_at
      FROM job_invoice_stage_payments jsp
      INNER JOIN job_invoice_settings jis 
        ON jsp.job_invoice_settings_id = jis.job_invoice_settings_id
      WHERE jis.builder_id = $1
      ORDER BY jsp.sort_order ASC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM job_invoice_stage_payments jsp
      INNER JOIN job_invoice_settings jis 
        ON jsp.job_invoice_settings_id = jis.job_invoice_settings_id
      WHERE jis.builder_id = $1;
    `;

    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        jobInvoiceStagePayments: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Job invoice stage payments fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching job invoice stage payments:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteJobInvoiceStagePayment = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT jsp.job_invoice_stage_payment_id
      FROM job_invoice_stage_payments jsp
      INNER JOIN job_invoice_settings jis 
        ON jsp.job_invoice_settings_id = jis.job_invoice_settings_id
      WHERE jsp.job_invoice_stage_payment_id = $1
        AND jis.builder_id = $2;
    `;

    const checkResult = await client.query(checkQuery, [id, builderId]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Job invoice stage payment not found or not authorized to delete."
      );
    }

    const deleteQuery = `
      DELETE FROM job_invoice_stage_payments
      WHERE job_invoice_stage_payment_id = $1;
    `;

    await client.query(deleteQuery, [id]);

    return successResponse(
      res,
      null,
      "Job invoice stage payment deleted successfully."
    );
  } catch (err) {
    console.error("Error deleting job invoice stage payment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobInvoiceStagePayment = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_invoice_stage_payment_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { description, percentage, sort_order } = req.body;

    const updatingOtherFields =
      description !== undefined ||
      percentage !== undefined ||
      sort_order !== undefined;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT 
        jsp.job_invoice_stage_payment_id, 
        jsp.job_invoice_settings_id,
        jsp.active
      FROM job_invoice_stage_payments jsp
      INNER JOIN job_invoice_settings jis 
        ON jsp.job_invoice_settings_id = jis.job_invoice_settings_id
      WHERE jsp.job_invoice_stage_payment_id = $1
        AND jis.builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      job_invoice_stage_payment_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Job invoice stage payment not found or unauthorized."
      );
    }

    const checkActiveQuery = `
      SELECT 
        jsp.job_invoice_stage_payment_id, 
        jsp.job_invoice_settings_id,
        jsp.active
      FROM job_invoice_stage_payments jsp
      INNER JOIN job_invoice_settings jis 
        ON jsp.job_invoice_settings_id = jis.job_invoice_settings_id
      WHERE jsp.job_invoice_stage_payment_id = $1
        AND jis.builder_id = $2 AND active = true;
    `;
    const checkActiveResult = await client.query(checkActiveQuery, [
      job_invoice_stage_payment_id,
      builderId,
    ]);

    if (checkActiveResult.rowCount === 0) {
      return errorResponse(res, 404, "Job invoice stage payment is inactive.");
    }

    const jobInvoiceSettingsId = checkResult.rows[0].job_invoice_settings_id;

    if (sort_order !== undefined) {
      const duplicateCheckQuery = `
        SELECT 1 
        FROM job_invoice_stage_payments 
        WHERE job_invoice_settings_id = $1 
          AND sort_order = $2
          AND job_invoice_stage_payment_id <> $3;
      `;
      const duplicateCheck = await client.query(duplicateCheckQuery, [
        jobInvoiceSettingsId,
        sort_order,
        job_invoice_stage_payment_id,
      ]);

      if (duplicateCheck.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "Sort order already exists for this setting."
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(description);
    }
    if (percentage !== undefined) {
      fields.push(`percentage = $${i++}`);
      values.push(percentage);
    }
    if (sort_order !== undefined) {
      fields.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    const updateQuery = `
      UPDATE job_invoice_stage_payments
      SET ${fields.join(", ")}
      WHERE job_invoice_stage_payment_id = $${i}
      RETURNING *;
    `;

    values.push(job_invoice_stage_payment_id);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Job invoice stage payment updated successfully."
    );
  } catch (err) {
    console.error("Error updating job invoice stage payment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobInvoiceStagePaymentIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_invoice_stage_payment_id } = req.params;
    const { active } = req.body;

    if (!job_invoice_stage_payment_id) {
      return errorResponse(
        res,
        400,
        "job invoice stage payment id is required"
      );
    }

    if (typeof active !== "boolean") {
      return errorResponse(res, 400, "active must be boolean (true or false)");
    }

    const existingQuery = `
      SELECT job_invoice_stage_payment_id
      FROM job_invoice_stage_payments
      WHERE job_invoice_stage_payment_id = $1;
    `;

    const existing = await client.query(existingQuery, [
      job_invoice_stage_payment_id,
    ]);

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Job invoice stage payment not found");
    }

    const updateQuery = `
      UPDATE job_invoice_stage_payments
      SET
        active = $1,
        updated_at = NOW()
      WHERE job_invoice_stage_payment_id = $2
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      active,
      job_invoice_stage_payment_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Job invoice stage payment status updated successfully."
    );
  } catch (error) {
    console.error(
      "Error updating job invoice stage payment active status:",
      error
    );
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
