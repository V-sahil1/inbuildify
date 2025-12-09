const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createCustomFieldValue = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user?.company_id;

    const {
      custom_field_id,
      record_id,
      value_text,
      value_number,
      value_date,
      value_boolean,
      value_list,
    } = req.body;

    await client.query("BEGIN");

    const fieldCheck = await client.query(
      `SELECT custom_field_id, field_type 
       FROM custom_field 
       WHERE custom_field_id = $1 
         AND builder_id = $2
         AND company_id = $3`,
      [custom_field_id, builderId, companyId]
    );

    if (fieldCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Custom field does not exist or does not belong to this builder."
      );
    }

    if (custom_field_id) {
      const customFieldCheck = await client.query(
        `SELECT custom_field_id 
     FROM custom_field
     WHERE builder_id = $1 
       AND custom_field_id = $2 
       AND is_active = true`,

        [builderId, custom_field_id]
      );

      if (customFieldCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "custom field id is inactive.");
      }
    }

    const leadCheck = await client.query(
      `SELECT lead_id 
       FROM leads 
       WHERE lead_id = $1 
         AND builder_id = $2 
         AND is_deleted = false`,
      [record_id, builderId]
    );

    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead not found with this record_id.");
    }

    const duplicateCheck = await client.query(
      `SELECT 1
       FROM custom_field_value
       WHERE record_id = $1 
         AND custom_field_id = $2 
         AND builder_id = $3`,
      [record_id, custom_field_id, builderId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Custom field value already exists for this record."
      );
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (value_date && !isValidDate(value_date)) {
      return errorResponse(res, 400, `Invalid date: ${value_date}`);
    }

    const insertQuery = `
      INSERT INTO custom_field_value (  
        custom_field_id,
        company_id,
        builder_id,
        record_id,
        value_text,
        value_number,
        value_date,
        value_boolean,
        value_list
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const insertValues = [
      custom_field_id,
      companyId,
      builderId,
      record_id,
      value_text || null,
      value_number || null,
      value_date || null,
      value_boolean ?? null,
      value_list || null,
    ];

    const result = await client.query(insertQuery, insertValues);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Custom field value created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating custom field value:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.getAllCustomFieldValue = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT
        cfv.custom_field_value_id,
        cfv.custom_field_id,
        cfv.company_id,
        cfv.builder_id,
        cfv.record_id,
        cfv.value_text,
        cfv.value_number,
        cfv.value_date,
        cfv.value_boolean,
        cfv.value_list,
        cfv.created_at,
        cfv.updated_at
      FROM custom_field_value cfv
      WHERE cfv.builder_id = $1
      ORDER BY cfv.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM custom_field_value
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        customFieldValues: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Custom field values fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching custom field values:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteCustomFieldValue = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { custom_field_value_id } = req.params;
    const builderId = req.user.builder_id;

    if (!custom_field_value_id) {
      return errorResponse(res, 400, "custom_field_value_id is required.");
    }

    await client.query("BEGIN");

    // Check if record exists and belongs to this builder
    const checkQuery = `
      SELECT custom_field_value_id 
      FROM custom_field_value 
      WHERE custom_field_value_id = $1 AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      custom_field_value_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Custom field value not found or does not belong to this builder."
      );
    }

    const deleteQuery = `
      DELETE FROM custom_field_value 
      WHERE custom_field_value_id = $1 AND builder_id = $2;
    `;
    await client.query(deleteQuery, [custom_field_value_id, builderId]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Custom field value deleted successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting custom field value:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateCustomFieldValue = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { custom_field_value_id } = req.params;
    const builderId = req.user.builder_id;
    const companyId = req.user?.company_id;

    const {
      record_id,
      custom_field_id,
      value_text,
      value_number,
      value_date,
      value_boolean,
      value_list,
    } = req.body;

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    if (!custom_field_value_id) {
      return errorResponse(res, 400, "custom_field_value_id is required.");
    }

    await client.query("BEGIN");

    const existingRecord = await client.query(
      `
      SELECT * FROM custom_field_value 
      WHERE custom_field_value_id = $1 AND builder_id = $2;
      `,
      [custom_field_value_id, builderId]
    );

    if (existingRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Custom field value not found or does not belong to this builder."
      );
    }

    if (custom_field_id !== undefined) {
      const fieldCheck = await client.query(
        `SELECT custom_field_id, field_type 
         FROM custom_field 
         WHERE custom_field_id = $1 
           AND builder_id = $2
           AND company_id = $3`,
        [custom_field_id, builderId, companyId]
      );

      if (fieldCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          404,
          "Custom field does not exist or does not belong to this builder."
        );
      }

      const customFieldCheck = await client.query(
        `SELECT custom_field_id 
         FROM custom_field
         WHERE builder_id = $1 
           AND custom_field_id = $2 
           AND is_active = true`,
        [builderId, custom_field_id]
      );

      if (customFieldCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "custom field id is inactive.");
      }
    }

    if (record_id !== undefined) {
      const leadCheck = await client.query(
        `SELECT lead_id 
         FROM leads 
         WHERE lead_id = $1 
           AND builder_id = $2 
           AND is_deleted = false`,
        [record_id, builderId]
      );

      if (leadCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Lead not found with this record_id.");
      }
    }

    if (record_id !== undefined || custom_field_id !== undefined) {
      const nextRecordId = record_id ?? existingRecord.rows[0].record_id;
      const nextFieldId =
        custom_field_id ?? existingRecord.rows[0].custom_field_id;

      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM custom_field_value
        WHERE record_id = $1
        AND custom_field_id = $2
        AND builder_id = $3
        AND custom_field_value_id != $4;
        `,
        [nextRecordId, nextFieldId, builderId, custom_field_value_id]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "This custom_field_id already contains value for this record_id."
        );
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (value_date && !isValidDate(value_date)) {
      return errorResponse(res, 400, `Invalid date: ${value_date}`);
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (record_id !== undefined) {
      fields.push(`record_id = $${index++}`);
      values.push(record_id);
    }

    if (custom_field_id !== undefined) {
      fields.push(`custom_field_id = $${index++}`);
      values.push(custom_field_id);
    }

    if (value_text !== undefined) {
      fields.push(`value_text = $${index++}`);
      values.push(value_text);
    }

    if (value_number !== undefined) {
      fields.push(`value_number = $${index++}`);
      values.push(value_number);
    }

    if (value_date !== undefined) {
      fields.push(`value_date = $${index++}`);
      values.push(value_date);
    }

    if (value_boolean !== undefined) {
      fields.push(`value_boolean = $${index++}`);
      values.push(value_boolean);
    }

    if (value_list !== undefined) {
      fields.push(`value_list = $${index++}`);
      values.push(value_list);
    }

    fields.push(`company_id = $${index++}`);
    values.push(companyId);

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No update fields provided.");
    }

    const updateQuery = `
      UPDATE custom_field_value
      SET ${fields.join(", ")}
      WHERE custom_field_value_id = $${index}
      RETURNING *;
    `;

    values.push(custom_field_value_id);

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Custom field value updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating custom field value:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
