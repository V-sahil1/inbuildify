const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createJobInvoiceSetting = async (req, res) => {
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
      `SELECT 1 FROM job_invoice_settings WHERE builder_id = $1 OR company_id = $2`,
      [builderId, companyId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Job invoice settings already exist for this builder."
      );
    }
    const { show_invoice_summary_in_pdf, invoice_terms_days } = req.body;

    const insertQuery = `
      INSERT INTO job_invoice_settings (
        company_id,
        builder_id,
        show_invoice_summary_in_pdf,
        invoice_terms_days,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, 
        $3, $4, $5, 
        $6
      )
      RETURNING 
       *
    `;

    const values = [
      companyId,
      builderId,
      show_invoice_summary_in_pdf ?? false,
      invoice_terms_days || 0,
      userId,
      userId,
    ];
    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job invoice settings created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job invocie settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobInvoiceSetting = async (req, res) => {
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
        "Unauthorized: Missing builder or company ID."
      );
    }

    const { show_invoice_summary_in_pdf, invoice_terms_days } = req.body;

    await client.query("BEGIN");

    // 🔹 Check record WITHOUT id
    const checkRecord = await client.query(
      `
      SELECT 1 
      FROM job_invoice_settings 
      WHERE builder_id = $1 OR company_id = $2
      `,
      [builderId, companyId]
    );

    if (checkRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job invoice settings not found for this user."
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (show_invoice_summary_in_pdf !== undefined) {
      fields.push(`show_invoice_summary_in_pdf = $${i++}`);
      values.push(show_invoice_summary_in_pdf);
    }

    if (invoice_terms_days !== undefined) {
      fields.push(`invoice_terms_days = $${i++}`);
      values.push(invoice_terms_days);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_invoice_settings
      SET ${fields.join(", ")}
      WHERE builder_id = $${i} OR company_id = $${i + 1}
      RETURNING show_invoice_summary_in_pdf, invoice_terms_days;
    `;

    values.push(builderId, companyId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job invoice settings updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job invoice settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserJobInvoiceSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT show_invoice_summary_in_pdf, invoice_terms_days
      FROM job_invoice_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO job_invoice_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        RETURNING show_invoice_summary_in_pdf, invoice_terms_days;
        `,
        [company_id, builder_id, user_id]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job invoice settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching job invoice settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
