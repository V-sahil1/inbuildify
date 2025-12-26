const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobCommissionSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.users_id;

    const { define_outgoing_commission, define_incoming_commission } = req.body;

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
        SELECT job_commission_settings_id 
        FROM job_commission_settings
        WHERE builder_id = $1 OR company_id = $2
      `,
      [builderId, companyId]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Commission settings already exist for this builder or company."
      );
    }

    const insertQuery = `
      INSERT INTO job_commission_settings (
        company_id,
        builder_id,
        define_outgoing_commission,
        define_incoming_commission,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      define_outgoing_commission ?? false,
      define_incoming_commission ?? false,
      createdBy,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job commission settings created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job commission settings:", err);
    return errorResponse(res, 500, err.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateJobCommissionSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_commission_settings_id } = req.params;
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

    const { define_outgoing_commission, define_incoming_commission } = req.body;

    const checkQuery = `
      SELECT * FROM job_commission_settings 
      WHERE job_commission_settings_id = $1 
      AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      job_commission_settings_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No commission setting found for this user."
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (define_outgoing_commission !== undefined) {
      fields.push(`define_outgoing_commission = $${i++}`);
      values.push(define_outgoing_commission);
    }

    if (define_incoming_commission !== undefined) {
      fields.push(`define_incoming_commission = $${i++}`);
      values.push(define_incoming_commission);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_commission_settings 
      SET ${fields.join(", ")} 
      WHERE job_commission_settings_id = $${i++} 
      AND (builder_id = $${i++} OR company_id = $${i})
      RETURNING *;
    `;

    values.push(job_commission_settings_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Failed to update commission settings.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Job commission settings updated successfully."
    );
  } catch (err) {
    console.error("Error updating job commission settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getUserJobCommissionSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT *
      FROM job_commission_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO job_commission_settings (
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
      "Job commission settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching job commission settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
