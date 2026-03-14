const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createRecalculateDate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const {
      recalculate_workflow_job_estimated_dates,
      recalculate_construction_job_estimated_dates,
      capture_reason_rebooking_and_rebooking_email,
      capture_text,
      recalculate_confirmed_booking_dates,
    } = req.body;

    await client.query("BEGIN");

    if (
      recalculate_construction_job_estimated_dates === false ||
      recalculate_construction_job_estimated_dates === "false" ||
      (recalculate_construction_job_estimated_dates === undefined &&
        (capture_reason_rebooking_and_rebooking_email !== undefined ||
          capture_text !== undefined ||
          recalculate_confirmed_booking_dates !== undefined))
    ) {
      return errorResponse(
        res,
        400,
        "When 'recalculate_construction_job_estimated_dates' is false, you cannot define 'capture_reason_rebooking_and_rebooking_email', 'capture_text', or 'recalculate_confirmed_booking_dates'."
      );
    }

    if (
      capture_reason_rebooking_and_rebooking_email === false ||
      capture_reason_rebooking_and_rebooking_email === "false" ||
      (capture_reason_rebooking_and_rebooking_email === undefined &&
        capture_text !== undefined)
    ) {
      return errorResponse(
        res,
        400,
        "When 'capture_reason_rebooking_and_rebooking_email' is false, you cannot define 'capture_text'."
      );
    }

    const duplicateCheckQuery = `
      SELECT recalculate_date_id 
      FROM recalculate_date 
      WHERE company_id = $1 AND builder_id = $2
      LIMIT 1
    `;
    const duplicateCheck = await client.query(duplicateCheckQuery, [
      companyId || null,
      builderId || null,
    ]);

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Recalculate Date settings already exist for this company/builder."
      );
    }

    const insertQuery = `
      INSERT INTO recalculate_date (
        company_id,
        builder_id,
        recalculate_workflow_job_estimated_dates,
        recalculate_construction_job_estimated_dates,
        capture_reason_rebooking_and_rebooking_email,
        capture_text,
        recalculate_confirmed_booking_dates,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      recalculate_workflow_job_estimated_dates || false,
      recalculate_construction_job_estimated_dates || false,
      capture_reason_rebooking_and_rebooking_email || false,
      capture_text || null,
      recalculate_confirmed_booking_dates || false,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Recalculate Date settings created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating recalculate date:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getRecalculateDate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const query = `
      SELECT *
      FROM recalculate_date
      WHERE builder_id = $1
         OR company_id = $2
      LIMIT 1;
    `;

    const result = await client.query(query, [
      builderId || null,
      companyId || null,
    ]);

    if (result.rowCount === 0) {
      const insertQuery = `
        INSERT INTO recalculate_date (
          builder_id, 
          company_id, 
          created_by, 
          updated_by
        ) VALUES ($1, $2, $3, $3)
        RETURNING *;
      `;

      const insertResult = await client.query(insertQuery, [
        builderId || null,
        companyId || null,
        req.user.users_id,
      ]);

      return successResponse(
        res,
        keysToCamelCase(insertResult.rows[0]),
        "Recalculate Date settings created and fetched successfully."
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Recalculate Date settings fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching recalculate date:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateRecalculateDate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const {
      recalculate_workflow_job_estimated_dates,
      recalculate_construction_job_estimated_dates,
      capture_reason_rebooking_and_rebooking_email,
      capture_text,
      recalculate_confirmed_booking_dates,
    } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM recalculate_date 
       WHERE (builder_id = $1 OR company_id = $2)
       FOR UPDATE`,
      [builderId, companyId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Recalculate Date record not found.");
    }

    const old = existing.rows[0];

    if (
      old.recalculate_construction_job_estimated_dates === false &&
      (recalculate_construction_job_estimated_dates === undefined ||
        recalculate_construction_job_estimated_dates === false ||
        recalculate_construction_job_estimated_dates === "false")
    ) {
      if (
        capture_reason_rebooking_and_rebooking_email !== undefined ||
        capture_text !== undefined ||
        recalculate_confirmed_booking_dates !== undefined
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Cannot update 'capture_reason_rebooking_and_rebooking_email', 'capture_text', or 'recalculate_confirmed_booking_dates' because 'recalculate_construction_job_estimated_dates' is already false. Set it to true first."
        );
      }
    }

    if (
      old.capture_reason_rebooking_and_rebooking_email === false &&
      capture_text !== undefined &&
      capture_reason_rebooking_and_rebooking_email === undefined
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "When 'capture_reason_rebooking_and_rebooking_email' is false, you cannot define 'capture_text'."
      );
    }

    if (
      recalculate_construction_job_estimated_dates === false ||
      recalculate_construction_job_estimated_dates === "false"
    ) {
      if (
        capture_reason_rebooking_and_rebooking_email !== undefined ||
        capture_text !== undefined ||
        recalculate_confirmed_booking_dates !== undefined
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "When 'recalculate_construction_job_estimated_dates' is false, you cannot define 'capture_reason_rebooking_and_rebooking_email', 'capture_text', or 'recalculate_confirmed_booking_dates'."
        );
      }
    }

    if (
      capture_reason_rebooking_and_rebooking_email === false ||
      capture_reason_rebooking_and_rebooking_email === "false"
    ) {
      if (capture_text !== undefined) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "When 'capture_reason_rebooking_and_rebooking_email' is false, you cannot define 'capture_text'."
        );
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (recalculate_workflow_job_estimated_dates !== undefined) {
      fields.push(
        `recalculate_workflow_job_estimated_dates = $${paramIndex++}`
      );
      values.push(recalculate_workflow_job_estimated_dates);
    }

    if (recalculate_construction_job_estimated_dates !== undefined) {
      fields.push(
        `recalculate_construction_job_estimated_dates = $${paramIndex++}`
      );
      values.push(recalculate_construction_job_estimated_dates);
    }

    if (
      recalculate_construction_job_estimated_dates === false ||
      recalculate_construction_job_estimated_dates === "false"
    ) {
      fields.push(
        `recalculate_confirmed_booking_dates = $${paramIndex++},
         capture_reason_rebooking_and_rebooking_email = $${paramIndex++},
         capture_text = NULL`
      );
      values.push(false, false);
    } else {
      if (capture_reason_rebooking_and_rebooking_email !== undefined) {
        fields.push(
          `capture_reason_rebooking_and_rebooking_email = $${paramIndex++}`
        );
        values.push(capture_reason_rebooking_and_rebooking_email);
      }

      if (
        capture_reason_rebooking_and_rebooking_email === false ||
        capture_reason_rebooking_and_rebooking_email === "false"
      ) {
        fields.push(`capture_text = NULL`);
      } else if (capture_text !== undefined) {
        fields.push(`capture_text = $${paramIndex++}`);
        values.push(capture_text);
      }

      if (recalculate_confirmed_booking_dates !== undefined) {
        fields.push(`recalculate_confirmed_booking_dates = $${paramIndex++}`);
        values.push(recalculate_confirmed_booking_dates);
      }
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update."
      );
    }

    fields.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE recalculate_date
      SET ${fields.join(", ")}
      WHERE (builder_id = $${paramIndex} OR company_id = $${paramIndex + 1})
      RETURNING *;
    `;

    values.push(builderId, companyId);

    const updated = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Recalculate Date settings updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating recalculate date:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
