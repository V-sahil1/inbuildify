const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobCommissionSubStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdBy = req.user?.users_id;
    const builderId = req.user?.builder_id;

    let {
      job_commission_id,
      name,
      commission_unit,
      commission_value,
      sort_order,
    } = req.body;

    const checkJobCommissionQuery = `
      SELECT jc.job_commission_id
      FROM job_commission jc
      INNER JOIN builder b ON jc.builder_id = b.builder_id
      WHERE jc.job_commission_id = $1 AND b.builder_id = $2
    `;

    const checkResult = await client.query(checkJobCommissionQuery, [
      job_commission_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid job_commission_id for this builder."
      );
    }

    // ----------------------------
    // COMMISSION UNIT VALIDATION
    // ----------------------------

    if (!commission_unit) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "commission_unit is required.");
    }

    if (!["percentage", "amount"].includes(commission_unit)) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "commission_unit must be 'percentage' or 'amount'."
      );
    }

    if (commission_value === undefined || commission_value === null) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "commission_value is required.");
    }

    const decimals = commission_value.toString().split(".")[1]?.length || 0;

    const digits = commission_value.toString().replace(".", "").length;

    if (commission_unit === "percentage") {
      if (commission_value > 100) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Percentage cannot exceed 100.");
      }
      if (decimals > 2) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Percentage cannot have more than 2 decimals."
        );
      }
      if (digits > 5) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Percentage exceeds precision limit (5,2)."
        );
      }
    }

    if (commission_unit === "amount") {
      if (commission_value > 99999999.99) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Amount cannot exceed 99999999.99 (precision 10,2)."
        );
      }
      if (decimals > 2) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Amount cannot have more than 2 decimals."
        );
      }
      if (digits > 10) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Amount exceeds precision limit (10,2)."
        );
      }
    }

    // ----------------------------
    // SORT ORDER VALIDATION
    // ----------------------------

    if (sort_order === undefined || sort_order === null) {
      sort_order = 0;
    }

    const duplicateQuery = `
      SELECT job_commission_sub_stage_id 
      FROM job_commission_sub_stage 
      WHERE job_commission_id = $1 
        AND sort_order = $2;
    `;

    const duplicateResult = await client.query(duplicateQuery, [
      job_commission_id,
      sort_order,
    ]);

    if (duplicateResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order ${sort_order} already exists for this job commission sub stage.`
      );
    }

    // ----------------------------
    // INSERT RECORD
    // ----------------------------
    const insertQuery = `
      INSERT INTO job_commission_sub_stage (
        job_commission_id,
        name,
        commission_unit,
        commission_value,
        sort_order,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *;
    `;

    const values = [
      job_commission_id,
      name,
      commission_unit,
      commission_value,
      sort_order,
      createdBy,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job commission sub stage created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job commission sub stage:", err);
    return errorResponse(res, 500, err.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllJobCommissionSubStages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { page = 1, limit = 25 } = req.query;

    const offset = (page - 1) * limit;

    const baseQuery = `
      FROM job_commission_sub_stage jcss
      INNER JOIN job_commission jc ON jcss.job_commission_id = jc.job_commission_id
      WHERE jc.builder_id = $1
    `;

    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    const countResult = await client.query(countQuery, [builderId]);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT 
        jcss.job_commission_sub_stage_id,
        jcss.job_commission_id,
        jcss.name,
        jcss.commission_unit,
        jcss.commission_value,
        jcss.sort_order,
        jcss.created_at,
        jcss.updated_at,
        jc.name AS job_commission_name
      ${baseQuery}
      ORDER BY jcss.sort_order ASC
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      limit,
      offset,
    ]);

    const resultData = keysToCamelCase(dataResult.rows);

    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      {
        jobCommissionSubStage: resultData,
        total,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
      },
      "Job commission sub stages fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching job commission sub stages:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getJobCommissionSubStagesByCommissionId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { job_commission_id } = req.params;
    const { page = 1, limit = 25 } = req.query;

    const offset = (page - 1) * limit;

    const checkCommissionQuery = `
      SELECT job_commission_id 
      FROM job_commission 
      WHERE job_commission_id = $1 AND builder_id = $2
    `;
    const checkResult = await client.query(checkCommissionQuery, [
      job_commission_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid job_commission_id for this builder."
      );
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM job_commission_sub_stage
      WHERE job_commission_id = $1
    `;
    const countResult = await client.query(countQuery, [job_commission_id]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const getSubStagesQuery = `
      SELECT 
        jcss.job_commission_sub_stage_id,
        jcss.name,
        jcss.commission_unit,
        jcss.commission_value,
        jcss.sort_order,
        jcss.created_at,
        jcss.updated_at
      FROM job_commission_sub_stage jcss
      WHERE jcss.job_commission_id = $1
      ORDER BY jcss.sort_order ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await client.query(getSubStagesQuery, [
      job_commission_id,
      limit,
      offset,
    ]);

    const subStages = keysToCamelCase(result.rows);

    return successResponse(
      res,
      {
        records: subStages,
        total,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
      },
      "Job commission sub stages fetched successfully."
    );
  } catch (error) {
    console.error(
      "Error fetching job commission sub stages by job_commission_id:",
      error
    );
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.deleteJobCommissionSubStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    const checkQuery = `
      SELECT jcss.job_commission_sub_stage_id
      FROM job_commission_sub_stage jcss
      INNER JOIN job_commission jc
        ON jc.job_commission_id = jcss.job_commission_id
      WHERE jcss.job_commission_sub_stage_id = $1
        AND jc.builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [id, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid job_commission_sub_stage_id for this builder."
      );
    }

    const deleteQuery = `
      DELETE FROM job_commission_sub_stage
      WHERE job_commission_sub_stage_id = $1
      RETURNING job_commission_sub_stage_id
    `;
    const deleteResult = await client.query(deleteQuery, [id]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Job commission sub stage not found.");
    }

    return successResponse(
      res,
      null,
      "Job commission sub stage deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting job commission sub stage:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updateJobCommissionSubStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const updatedBy = req.user?.users_id;
    const { job_commission_sub_stage_id } = req.params;
    const { name, commission_unit, commission_value, sort_order } = req.body;

    const checkQuery = `
      SELECT jcss.job_commission_id, jcss.sort_order,
             jcss.commission_unit AS old_unit,
             jcss.commission_value AS old_value
      FROM job_commission_sub_stage jcss
      INNER JOIN job_commission jc
        ON jc.job_commission_id = jcss.job_commission_id
      WHERE jcss.job_commission_sub_stage_id = $1
        AND jc.builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [
      job_commission_sub_stage_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid job_commission_sub_stage_id for this builder."
      );
    }

    const row = checkResult.rows[0];
    const jobCommissionId = row.job_commission_id;
    const oldUnit = row.old_unit;
    const oldValue = Number(row.old_value);

    if (sort_order !== undefined && sort_order !== row.sort_order) {
      const sortCheckQuery = `
        SELECT 1 FROM job_commission_sub_stage
        WHERE job_commission_id = $1
          AND sort_order = $2
          AND job_commission_sub_stage_id <> $3
      `;
      const sortCheck = await client.query(sortCheckQuery, [
        jobCommissionId,
        sort_order,
        job_commission_sub_stage_id,
      ]);

      if (sortCheck.rows.length > 0) {
        return errorResponse(
          res,
          400,
          "This sort order is already in use for this job commission."
        );
      }
    }

    if (commission_unit === "percentage" && oldUnit === "amount") {
      const val = commission_value ?? oldValue;
      if (Number(val) > 100) {
        return errorResponse(
          res,
          400,
          "Cannot convert amount to percentage because commission_value is greater than 100."
        );
      }
    }

    if (commission_unit === "amount" && oldUnit === "percentage") {
      const val = commission_value ?? oldValue;
      const digits = val.toString().replace(".", "").length;
      const decimals = val.toString().split(".")[1]?.length || 0;
      if (decimals > 2 || digits > 10) {
        return errorResponse(
          res,
          400,
          "Cannot convert percentage to amount because commission_value exceeds (10,2) precision."
        );
      }
    }

    if (commission_value !== undefined && commission_unit === undefined) {
      const val = commission_value;
      const decimals = val.toString().split(".")[1]?.length || 0;
      const digits = val.toString().replace(".", "").length;

      if (oldUnit === "percentage") {
        if (val > 100)
          return errorResponse(res, 400, "Percentage cannot exceed 100.");
        if (decimals > 2)
          return errorResponse(
            res,
            400,
            "Percentage cannot have more than 2 decimals."
          );
        if (digits > 5)
          return errorResponse(
            res,
            400,
            "Percentage exceeds precision limit (5,2)."
          );
      }

      if (oldUnit === "amount") {
        if (decimals > 2)
          return errorResponse(
            res,
            400,
            "Amount cannot have more than 2 decimals."
          );
        if (digits > 10)
          return errorResponse(
            res,
            400,
            "Amount exceeds precision limit (10,2)."
          );
      }
    }

    if (commission_unit && commission_value !== undefined) {
      const val = commission_value;
      const decimals = val.toString().split(".")[1]?.length || 0;
      const digits = val.toString().replace(".", "").length;

      if (commission_unit === "percentage") {
        if (val > 100)
          return errorResponse(res, 400, "Percentage cannot exceed 100.");
        if (decimals > 2)
          return errorResponse(
            res,
            400,
            "Percentage cannot have more than 2 decimals."
          );
        if (digits > 5)
          return errorResponse(
            res,
            400,
            "Percentage exceeds precision limit (5,2)."
          );
      }

      if (commission_unit === "amount") {
        if (decimals > 2)
          return errorResponse(
            res,
            400,
            "Amount cannot have more than 2 decimals."
          );
        if (digits > 10)
          return errorResponse(
            res,
            400,
            "Amount exceeds precision limit (10,2)."
          );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined) {
      fields.push(`name = $${i++}`);
      values.push(name);
    }
    if (commission_unit !== undefined) {
      fields.push(`commission_unit = $${i++}`);
      values.push(commission_unit);
    }
    if (commission_value !== undefined) {
      fields.push(`commission_value = $${i++}`);
      values.push(commission_value);
    }
    if (sort_order !== undefined) {
      fields.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(updatedBy);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_commission_sub_stage
      SET ${fields.join(", ")}
      WHERE job_commission_sub_stage_id = $${i}
      RETURNING job_commission_sub_stage_id, name, commission_unit, commission_value, sort_order, updated_at
    `;
    values.push(job_commission_sub_stage_id);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Job commission sub stage not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Job commission sub stage updated successfully."
    );
  } catch (error) {
    console.error("Error updating job commission sub stage:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};
