const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createHoliday = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    await client.query("BEGIN");

    const {
      state,
      holiday_start_date,
      holiday_end_date,
      holiday_description,
      status,
    } = req.body;

    if (!companyId && !builderId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Either company_id or builder_id must be present."
      );
    }

    if (state && Array.isArray(state) && state.length > 0) {
      const stateCheckQuery = `
        SELECT state_id FROM state WHERE state_id = ANY($1);
      `;
      const stateCheckResult = await client.query(stateCheckQuery, [state]);

      if (stateCheckResult.rowCount !== state.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "One or more state IDs are invalid.");
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (holiday_start_date && !isValidDate(holiday_start_date)) {
      return errorResponse(res, 400, `Invalid date: ${holiday_start_date}`);
    }

    if (holiday_end_date && !isValidDate(holiday_end_date)) {
      return errorResponse(res, 400, `Invalid date: ${holiday_end_date}`);
    }

    if (new Date(holiday_start_date) > new Date(holiday_end_date)) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "holiday_start_date cannot be greater than holiday_end_date."
      );
    }

    // const overlapQuery = `
    //   SELECT holiday_id
    //   FROM holiday
    //   WHERE
    //     (company_id = $1 OR builder_id = $2)
    //     AND (
    //       (holiday_start_date, holiday_end_date) OVERLAPS ($3::date, $4::date)
    //     );
    // `;

    // const overlapCheck = await client.query(overlapQuery, [
    //   companyId || null,
    //   builderId || null,
    //   holiday_start_date,
    //   holiday_end_date,
    // ]);

    // if (overlapCheck.rowCount > 0) {
    //   await client.query("ROLLBACK");
    //   return errorResponse(
    //     res,
    //     400,
    //     "Another holiday exists within this date range."
    //   );
    // }

    const insertQuery = `
      INSERT INTO holiday (
        company_id,
        builder_id,
        state,
        holiday_start_date,
        holiday_end_date,
        holiday_description,
        status,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *;
    `;

    const values = [
      companyId || null,
      builderId || null,
      state || [],
      holiday_start_date,
      holiday_end_date,
      holiday_description,
      status ?? true,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Holiday created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating holiday:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllHolidays = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    if (!companyId && !builderId) {
      return errorResponse(
        res,
        400,
        "Either company_id or builder_id must be present."
      );
    }

    let { page = 1, limit = 10 } = req.query;
    const pageValue = parseInt(page) || 1;
    const limitValue = parseInt(limit) || 10;
    const offset = (pageValue - 1) * limitValue;

    const {
      state,
      holiday_start_date,
      holiday_end_date,
      holiday_description,
      status,
    } = req.query;

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (holiday_start_date && !isValidDate(holiday_start_date)) {
      return errorResponse(res, 400, `Invalid date: ${holiday_start_date}`);
    }

    if (holiday_end_date && !isValidDate(holiday_end_date)) {
      return errorResponse(res, 400, `Invalid date: ${holiday_end_date}`);
    }

    let whereClauses = [];
    let values = [];
    let index = 1;

    whereClauses.push(`(company_id = $${index} OR builder_id = $${index + 1})`);
    values.push(companyId || null, builderId || null);
    index += 2;

    if (state) {
      whereClauses.push(`state && $${index}::uuid[]`);
      values.push(state.split(","));
      index++;
    }

    if (holiday_start_date) {
      whereClauses.push(`holiday_start_date >= $${index}`);
      values.push(holiday_start_date);
      index++;
    }

    if (holiday_end_date) {
      whereClauses.push(`holiday_end_date <= $${index}`);
      values.push(holiday_end_date);
      index++;
    }

    if (holiday_description) {
      whereClauses.push(`LOWER(holiday_description) LIKE LOWER($${index})`);
      values.push(`%${holiday_description}%`);
      index++;
    }

    if (status !== undefined) {
      whereClauses.push(`status = $${index}`);
      values.push(status === "true");
      index++;
    }

    const whereSQL = whereClauses.length
      ? "WHERE " + whereClauses.join(" AND ")
      : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM holiday
      ${whereSQL};
    `;

    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT *
      FROM holiday
      ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${index} OFFSET $${index + 1};
    `;

    const dataValues = [...values, limitValue, offset];

    const dataResult = await client.query(dataQuery, dataValues);

    return successResponse(
      res,
      {
        holidays: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Holidays fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteHoliday = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    const checkQuery = `
      SELECT holiday_id
      FROM holiday
      WHERE holiday_id = $1
        AND company_id = $2
        AND builder_id = $3
      LIMIT 1;
    `;

    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Holiday not found");
    }

    const deleteQuery = `
      DELETE FROM holiday
      WHERE holiday_id = $1
        AND company_id = $2
        AND builder_id = $3
      RETURNING holiday_id;
    `;

    const deleteResult = await client.query(deleteQuery, [
      id,
      companyId,
      builderId,
    ]);

    return successResponse(res, {}, "Holiday deleted permanently.");
  } catch (error) {
    console.error("Delete Holiday Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateHoliday = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { holiday_id } = req.params;
    const companyId = req.user.company_id;
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;

    if (!holiday_id) {
      return errorResponse(res, 400, "Holiday ID is required.");
    }

    const {
      state,
      holiday_start_date,
      holiday_end_date,
      holiday_description,
      status,
    } = req.body;

    await client.query("BEGIN");

    const existingHoliday = await client.query(
      `SELECT * FROM holiday 
       WHERE holiday_id = $1 AND company_id = $2 AND builder_id = $3 FOR UPDATE`,
      [holiday_id, companyId, builderId]
    );

    if (existingHoliday.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Holiday not found.");
    }

    const oldData = existingHoliday.rows[0];

    const currentStatus = oldData.status;
    const statusInBody = status !== undefined;
    const requestedStatus = status;

    const fieldsToCheck = [
      "state",
      "holiday_start_date",
      "holiday_end_date",
      "holiday_description",
    ];

    const updatingOtherFields = fieldsToCheck.some((field) =>
      req.body.hasOwnProperty(field)
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'status' field must be a boolean (true or false)."
      );
    }

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active holiday, 'status' must be the only field provided in the request."
        );
      }
    }

    if (currentStatus === false) {
      const performingActivation = statusInBody && requestedStatus === true;

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Holiday is already Inactive. 'status' can only be updated to true (Active) from this state."
        );
      }

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'status' fields when the holiday is currently Inactive. Only 'status' can be changed (to true/Active)."
        );
      }
    }

    if (state) {
      const stateArray = typeof state === "string" ? state.split(",") : state;

      const stateCheck = await client.query(
        `SELECT state_id FROM state WHERE state_id = ANY($1::uuid[])`,
        [stateArray]
      );

      if (stateCheck.rowCount !== stateArray.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "One or more state ids are invalid.");
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    const oldStartDate = oldData.holiday_start_date
      ? oldData.holiday_start_date.toLocaleDateString("en-CA")
      : null;
    const oldEndDate = oldData.holiday_end_date
      ? oldData.holiday_end_date.toLocaleDateString("en-CA")
      : null;

    const check_start_date = holiday_start_date || oldStartDate;
    const check_end_date = holiday_end_date || oldEndDate;

    if (new Date(check_start_date) > new Date(check_end_date)) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "holiday_end_date cannot be earlier than holiday_start_date."
      );
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (state) {
      const stateArray = typeof state === "string" ? state.split(",") : state;

      fields.push(`state = $${paramIndex++}`);
      values.push(stateArray);
    }

    if (holiday_start_date) {
      fields.push(`holiday_start_date = $${paramIndex++}`);
      values.push(holiday_start_date);
    }

    if (holiday_end_date) {
      fields.push(`holiday_end_date = $${paramIndex++}`);
      values.push(holiday_end_date);
    }

    if (holiday_description) {
      fields.push(`holiday_description = $${paramIndex++}`);
      values.push(holiday_description);
    }

    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE holiday
      SET ${fields.join(", ")}
      WHERE holiday_id = $${paramIndex}
        AND company_id = $${paramIndex + 1}
        AND builder_id = $${paramIndex + 2}
      RETURNING *;
    `;

    values.push(holiday_id, companyId, builderId);

    const updated = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Holiday updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating holiday:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
