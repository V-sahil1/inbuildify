const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobCommission = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.users_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID is required.");
    }

    let {
      commission_type,
      name,
      recipient,
      recipient_user_id,
      commission_unit,
      commission_value,
      sort_order,
    } = req.body;

    await client.query("BEGIN");

    const settingsQuery = `
      SELECT job_commission_settings_id, define_outgoing_commission, define_incoming_commission
      FROM job_commission_settings 
      WHERE builder_id = $1
      LIMIT 1;
    `;
    const settingsResult = await client.query(settingsQuery, [builderId]);

    if (settingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "No job commission settings found for this builder."
      );
    }

    const settings = settingsResult.rows[0];

    if (
      (commission_type === "outgoing" &&
        !settings.define_outgoing_commission) ||
      (commission_type === "incoming" && !settings.define_incoming_commission)
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Cannot create ${commission_type} commission. Corresponding setting is not enabled.`
      );
    }

    if (commission_type === "incoming") {
      if (recipient || recipient_user_id) {
        return errorResponse(
          res,
          400,
          "Recipient and recipient user cannot be defined for incoming commission."
        );
      }
    }

    if (recipient_user_id) {
      const userCheck = await client.query(
        `
        SELECT users_id
        FROM users
        WHERE users_id = $1 AND is_deleted = false
        `,
        [recipient_user_id]
      );

      if (userCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Recipient user id is not valid.");
      }
    }
    const jobCommissionSettingsId =
      settingsResult.rows[0].job_commission_settings_id;

    if (sort_order === undefined || sort_order === null) {
      const maxSortQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort
    FROM job_commission
    WHERE job_commission_settings_id = $1
      AND commission_type = $2
  `;
      const maxSortResult = await client.query(maxSortQuery, [
        jobCommissionSettingsId,
        commission_type,
      ]);
      sort_order = maxSortResult.rows[0].max_sort + 1;
    }

    // Duplicate sort check per commission_type
    const duplicateQuery = `
  SELECT job_commission_id 
  FROM job_commission 
  WHERE job_commission_settings_id = $1 
    AND sort_order = $2
    AND commission_type = $3
`;
    const duplicateResult = await client.query(duplicateQuery, [
      jobCommissionSettingsId,
      sort_order,
      commission_type,
    ]);

    if (duplicateResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order ${sort_order} already exists for ${commission_type} commission.`
      );
    }

    const insertQuery = `
      INSERT INTO job_commission (
        company_id,
        builder_id,
        job_commission_settings_id,
        commission_type,
        name,
        recipient,
        recipient_user_id,
        commission_unit,
        commission_value,
        sort_order,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      jobCommissionSettingsId,
      commission_type,
      name,
      recipient,
      recipient_user_id || null,
      commission_unit,
      commission_value,
      sort_order ?? 1,
      createdBy,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job commission created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job commission:", err);
    return errorResponse(res, 500, err.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllJobCommissions = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    let { page = 1, limit = 25, commission_type } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const offset = (page - 1) * limit;

    const conditions = [`jc.builder_id = $1`];
    const values = [builderId];
    let paramIndex = 2;

    if (commission_type) {
      conditions.push(`jc.commission_type = $${paramIndex++}`);
      values.push(commission_type);
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM job_commission jc
      WHERE ${whereClause};
    `;
    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limit);

    const dataQuery = `
      SELECT *
      FROM job_commission jc
      WHERE ${whereClause}
      ORDER BY jc.sort_order ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const dataValues = [...values, limit, offset];
    const result = await client.query(dataQuery, dataValues);

    return successResponse(
      res,
      {
        jobCommission: keysToCamelCase(result.rows),
        pagination: {
          totalRecords,
          totalPages,
          currentPage: page,
          pageSize: limit,
        },
      },
      "Job commissions fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching job commissions:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteJobCommission = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_commission_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT job_commission_id 
      FROM job_commission 
      WHERE job_commission_id = $1 AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      job_commission_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job commission not found or unauthorized to delete."
      );
    }

    const deleteQuery = `
      DELETE FROM job_commission
      WHERE job_commission_id = $1 AND builder_id = $2;
    `;
    await client.query(deleteQuery, [job_commission_id, builderId]);

    await client.query("COMMIT");

    return successResponse(res, null, "Job commission deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting job commission:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobCommission = async (req, res) => {
  const { job_commission_id } = req.params;
  const builderId = req.user?.builder_id;
  const userId = req.user?.users_id;

  // Remove commission_type from request body
  const {
    name,
    recipient,
    recipient_user_id,
    commission_unit,
    commission_value,
    sort_order,
  } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const settingsQuery = `
      SELECT job_commission_settings_id, define_outgoing_commission, define_incoming_commission
      FROM job_commission_settings 
      WHERE builder_id = $1
      LIMIT 1;
    `;
    const settingsResult = await client.query(settingsQuery, [builderId]);

    if (settingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No job commission settings found.");
    }

    if (
      name === undefined &&
      recipient === undefined &&
      recipient_user_id === undefined &&
      commission_unit === undefined &&
      commission_value === undefined &&
      sort_order === undefined
    ) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    const settings = settingsResult.rows[0];

    const existingQ = await client.query(
      `SELECT commission_type, commission_unit, commission_value, recipient, recipient_user_id 
       FROM job_commission WHERE job_commission_id = $1`,
      [job_commission_id]
    );

    if (existingQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Job commission not found.");
    }

    const old = existingQ.rows[0];
    const commission_type = old.commission_type; // keep existing type

    // --- START: Incoming/outgoing validation (same as create API) ---
    if (commission_type === "incoming") {
      if (recipient || recipient_user_id) {
        return errorResponse(
          res,
          400,
          "Recipient and recipient user cannot be defined for incoming commission."
        );
      }
    }

    if (commission_type === "outgoing") {
      if (!recipient) {
        return errorResponse(
          res,
          400,
          "Recipient is required for outgoing commission."
        );
      }

      if (recipient === "other_user" && !recipient_user_id) {
        return errorResponse(
          res,
          400,
          "recipient_user_id is required when recipient is 'other_user'."
        );
      }

      if (recipient !== "other_user" && recipient_user_id) {
        return errorResponse(
          res,
          400,
          "recipient_user_id is allowed only when recipient is 'other_user'."
        );
      }
    }
    // --- END: Incoming/outgoing validation ---

    const finalRecipient = recipient ?? old.recipient;
    const finalRecipientUser =
      finalRecipient === "other_user"
        ? recipient_user_id ?? old.recipient_user_id
        : null;

    if (finalRecipient === "other_user" && finalRecipientUser) {
      const userCheck = await client.query(
        `SELECT users_id FROM users WHERE users_id = $1`,
        [finalRecipientUser]
      );

      if (userCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Recipient user id is not valid.");
      }
    }

    let finalUnit = commission_unit ?? old.commission_unit;
    let finalValue = commission_value ?? old.commission_value;

    if (finalUnit === "percentage") {
      if (Number(finalValue) > 100) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Percentage cannot exceed 100.");
      }

      const decimals = finalValue?.toString().split(".")[1]?.length || 0;
      if (decimals > 2) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Percentage cannot have more than 2 decimals."
        );
      }
    }

    if (finalUnit === "amount") {
      const decimals = finalValue?.toString().split(".")[1]?.length || 0;
      if (decimals > 2) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Amount cannot have more than 2 decimals."
        );
      }

      const digits = finalValue.toString().replace(".", "").length;
      if (digits > 10) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Amount exceeds precision limit (10,2)."
        );
      }
    }

    const jobCommissionSettingsId = settings.job_commission_settings_id;

    // --- START: Sort order assignment (like create API) ---
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM job_commission
        WHERE job_commission_settings_id = $1
          AND commission_type = $2
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        jobCommissionSettingsId,
        commission_type,
      ]);
      finalSortOrder = maxSortResult.rows[0].max_sort + 1;
    }

    // Duplicate check per type
    const duplicateSort = await client.query(
      `SELECT job_commission_id FROM job_commission
       WHERE job_commission_settings_id = $1 
         AND sort_order = $2 
         AND commission_type = $3
         AND job_commission_id <> $4`,
      [
        jobCommissionSettingsId,
        finalSortOrder,
        commission_type,
        job_commission_id,
      ]
    );

    if (duplicateSort.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order ${finalSortOrder} already exists for ${commission_type} commission.`
      );
    }
    // --- END: Sort order assignment ---

    let i = 1;
    const fields = [];
    const values = [];

    const assign = (col, val) => {
      if (val !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(val);
      }
    };

    // commission_type removed: cannot be updated
    assign("name", name);
    assign("recipient", recipient);
    assign("commission_unit", commission_unit);
    assign("commission_value", commission_value);
    assign("sort_order", finalSortOrder);

    if (finalRecipient !== "other_user") {
      fields.push(`recipient_user_id = $${i++}`);
      values.push(null);
    } else {
      fields.push(`recipient_user_id = $${i++}`);
      values.push(finalRecipientUser);
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_commission
      SET ${fields.join(", ")}
      WHERE job_commission_id = $${i}
      RETURNING *;
    `;
    values.push(job_commission_id);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job commission updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job commission:", err);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};
