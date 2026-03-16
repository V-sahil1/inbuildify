import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createJobInvoiceStagePayment(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { description, percentage, sort_order } = req.body;

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
        "Job invoice settings not found for this builder.",
      );
    }

    const jobInvoiceSettingsId = settingsResult.rows[0].job_invoice_settings_id;

    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_invoice_stage_payments
      WHERE job_invoice_settings_id = $1
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      jobInvoiceSettingsId,
    ]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    const shiftSortOrderQuery = `
      UPDATE job_invoice_stage_payments
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND job_invoice_settings_id = $2
    `;
    await client.query(shiftSortOrderQuery, [
      finalSortOrder,
      jobInvoiceSettingsId,
    ]);

    const insertQuery = `
      INSERT INTO job_invoice_stage_payments (
        job_invoice_settings_id,
        description,
        percentage,
        sort_order
      )
      VALUES ($1, $2, $3, $4)
      RETURNING job_invoice_stage_payment_id, job_invoice_settings_id, description, percentage, sort_order, created_at, updated_at;
    `;

    const values = [
      jobInvoiceSettingsId,
      description.trim(),
      percentage || 0,
      finalSortOrder,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job invoice stage payment created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job invoice stage payment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllJobInvoiceStagePayments(req, res) {
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
      "Job invoice stage payments fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching job invoice stage payments:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteJobInvoiceStagePayment(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT jsp.job_invoice_stage_payment_id, jsp.sort_order, jsp.job_invoice_settings_id
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
        "Job invoice stage payment not found or not authorized to delete.",
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;
    const jobInvoiceSettingsId = checkResult.rows[0].job_invoice_settings_id;

    const deleteQuery = `
      DELETE FROM job_invoice_stage_payments
      WHERE job_invoice_stage_payment_id = $1;
    `;

    await client.query(deleteQuery, [id]);

    await client.query(
      "UPDATE job_invoice_stage_payments SET sort_order = sort_order - 1 WHERE sort_order > $1 AND job_invoice_settings_id = $2",
      [deletedSortOrder, jobInvoiceSettingsId],
    );

    return successResponse(
      res,
      null,
      "Job invoice stage payment deleted successfully.",
    );
  } catch (err) {
    console.error("Error deleting job invoice stage payment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateJobInvoiceStagePayment(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_invoice_stage_payment_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { description, percentage, sort_order } = req.body;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT 
        jsp.job_invoice_stage_payment_id, 
        jsp.job_invoice_settings_id,
        jsp.sort_order
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
        "Job invoice stage payment not found or unauthorized.",
      );
    }

    const jobInvoiceSettingsId = checkResult.rows[0].job_invoice_settings_id;
    const existingSortOrder = checkResult.rows[0].sort_order;

    if (sort_order !== undefined && sort_order !== null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM job_invoice_stage_payments
        WHERE job_invoice_settings_id = $1
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        jobInvoiceSettingsId,
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
            UPDATE job_invoice_stage_payments
            SET sort_order = sort_order - 1
            WHERE sort_order > $1
              AND sort_order <= $2
              AND job_invoice_stage_payment_id != $3
              AND job_invoice_settings_id = $4
            `,
            [
              existingSortOrder,
              sort_order,
              job_invoice_stage_payment_id,
              jobInvoiceSettingsId,
            ],
          );
        } else {
          await client.query(
            `
            UPDATE job_invoice_stage_payments
            SET sort_order = sort_order + 1
            WHERE sort_order >= $1
              AND sort_order < $2
              AND job_invoice_stage_payment_id != $3
              AND job_invoice_settings_id = $4
            `,
            [
              sort_order,
              existingSortOrder,
              job_invoice_stage_payment_id,
              jobInvoiceSettingsId,
            ],
          );
        }
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

    fields.push("updated_at = NOW()");

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
      "Job invoice stage payment updated successfully.",
    );
  } catch (err) {
    console.error("Error updating job invoice stage payment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
