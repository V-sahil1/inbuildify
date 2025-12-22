const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createCustomField = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const companyId = req.user?.company_id;

    const { module_id, field_name, field_type, sort_order, is_active } =
      req.body;

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    const validTypes = [
      "text",
      "number",
      "date",
      "checkbox",
      "list",
      "multiline",
    ];
    if (!validTypes.includes(field_type.toLowerCase())) {
      return errorResponse(
        res,
        400,
        "Invalid field_type. Must be one of: text, number, date, checkbox, list, multiline."
      );
    }

    await client.query("BEGIN");
    const validateModule = await client.query(
      `SELECT module_id FROM custom_field_module WHERE module_id = $1`,
      [module_id]
    );

    if (validateModule.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid module_id. Module not found in custom_field_module."
      );
    }
    const duplicateField = await client.query(
      `
      SELECT 1 
      FROM custom_field
      WHERE module_id = $1
        AND builder_id = $2
        AND company_id = $3
        AND LOWER(field_name) = LOWER($4)
      `,
      [module_id, builderId, companyId, field_name.trim()]
    );

    if (duplicateField.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Custom field with this name already exists for this module."
      );
    }

    const finalSortOrder = sort_order ?? 0;

    const duplicateSort = await client.query(
      `
      SELECT 1 
      FROM custom_field
      WHERE module_id = $1
        AND builder_id = $2
        AND company_id = $3
        AND sort_order = $4
      `,
      [module_id, builderId, companyId, finalSortOrder]
    );

    if (duplicateSort.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Sort order already exists — please choose another."
      );
    }

    const insertQuery = `
      INSERT INTO custom_field (
        company_id,
        builder_id,
        module_id,
        field_name,
        field_type,
        sort_order,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      module_id,
      field_name.trim(),
      field_type.toLowerCase(),
      finalSortOrder,
      is_active ?? true,
      userId || null,
      userId || null,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        ...keysToCamelCase(result.rows[0]),
        companyId,
        module_id,
      },
      "Custom field created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating custom field:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllCustomFields = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(
        res,
        400,
        "Builder ID is missing from user context."
      );
    }

    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM custom_field
      WHERE builder_id = $1 AND company_id = $2;
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT 
        *
      FROM custom_field
      WHERE builder_id = $1 AND company_id = $2
      ORDER BY sort_order ASC
      LIMIT $3 OFFSET $4;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      companyId,
      limitValue,
      offset,
    ]);

    return successResponse(
      res,
      {
        customFields: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Custom fields fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching custom fields:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteCustomField = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID missing from user context.");
    }

    if (!id) {
      return errorResponse(res, 400, "Custom Field ID is required.");
    }
    const checkQuery = `
      SELECT custom_field_id 
      FROM custom_field 
      WHERE custom_field_id = $1 AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [id, builderId]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Custom field not found.");
    }
    const deleteQuery = `
      DELETE FROM custom_field 
      WHERE custom_field_id = $1 AND builder_id = $2;
    `;
    await client.query(deleteQuery, [id, builderId]);

    return successResponse(res, null, "Custom field deleted successfully.");
  } catch (error) {
    console.error("Error deleting custom field:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateCustomField = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;

    const { field_name, field_type, sort_order } = req.body;

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    const existingQuery = `
      SELECT * FROM custom_field 
      WHERE custom_field_id = $1 AND builder_id = $2 FOR UPDATE;
    `;
    const existingResult = await client.query(existingQuery, [id, builderId]);

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Custom field not found or not owned by this builder."
      );
    }

    const existingActiveQuery = `
      SELECT * FROM custom_field 
      WHERE custom_field_id = $1 AND builder_id = $2 AND is_active = true FOR UPDATE;
    `;
    const existingActiveResult = await client.query(existingActiveQuery, [
      id,
      builderId,
    ]);

    if (existingActiveResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "inactive custom field.");
    }

    const existing = existingResult.rows[0];
    const moduleId = existing.module_id;

    if (
      field_type &&
      Array.isArray(existing.options) &&
      existing.options.length > 0 &&
      field_type.toLowerCase() !== existing.field_type
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Field type cannot be updated because options already exist for this field."
      );
    }

    if (field_name) {
      const duplicateField = await client.query(
        `
        SELECT 1
        FROM custom_field
        WHERE module_id = $1 
          AND LOWER(field_name) = LOWER($2)
          AND builder_id = $3
          AND custom_field_id != $4;
        `,
        [moduleId, field_name, builderId, id]
      );

      if (duplicateField.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Custom field with this name already exists."
        );
      }
    }

    if (sort_order !== undefined) {
      const duplicateSort = await client.query(
        `
        SELECT 1
        FROM custom_field
        WHERE module_id = $1 
          AND sort_order = $2
          AND builder_id = $3
          AND custom_field_id != $4;
        `,
        [moduleId, sort_order, builderId, id]
      );
      if (duplicateSort.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Sort order number already exists.");
      }
    }

    const validTypes = [
      "text",
      "number",
      "date",
      "checkbox",
      "list",
      "multiline",
    ];
    if (field_type && !validTypes.includes(field_type.toLowerCase())) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid field_type. Must be one of: text, number, date, checkbox, list, multiline."
      );
    }

    const updateQuery = `
      UPDATE custom_field
      SET
        field_name = COALESCE($1, field_name),
        field_type = COALESCE($2, field_type),
        sort_order = COALESCE($3, sort_order),
        updated_by = $4,
        updated_at = NOW(),
        company_id = $5,
        builder_id = $6
      WHERE custom_field_id = $7
      RETURNING *;
    `;
    const values = [
      field_name || null,
      field_type ? field_type.toLowerCase() : null,
      sort_order ?? existing.sort_order,
      userId || null,
      companyId,
      builderId,
      id,
    ];

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Custom field updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating custom field:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateCustomFieldIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { is_active } = req.body;

    if (!id) {
      return errorResponse(res, 400, "custom field id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)"
      );
    }

    const existing = await client.query(
      `
      SELECT custom_field_id
      FROM custom_field
      WHERE custom_field_id = $1
        AND builder_id = $2
      `,
      [id, builderId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "custom field not found for this builder");
    }

    const updateQuery = `
      UPDATE custom_field
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE custom_field_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [is_active, userId, id]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "custom field status updated successfully."
    );
  } catch (error) {
    console.error("Error updating custom field is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.createOption = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { custom_field_id, options } = req.body;

    if (!custom_field_id || !Array.isArray(options) || options.length === 0) {
      return errorResponse(
        res,
        400,
        "custom_field_id and options array are required."
      );
    }

    const fieldQuery = `
      SELECT custom_field_id, field_type, options
      FROM custom_field
      WHERE custom_field_id = $1
        AND (
          (builder_id = $2 AND $2 IS NOT NULL)
          OR (company_id = $3 AND $3 IS NOT NULL)
        );
    `;

    const fieldResult = await client.query(fieldQuery, [
      custom_field_id,
      builderId,
      companyId,
    ]);

    if (fieldResult.rowCount === 0) {
      return errorResponse(res, 404, "Custom field not found.");
    }

    const field = fieldResult.rows[0];

    if (field.field_type !== "list") {
      return errorResponse(
        res,
        400,
        "Options can only be added to fields of type 'list'."
      );
    }

    const existingOptions = field.options || [];

    const normalizedExisting = existingOptions.map((o) => o.toLowerCase());
    const newUniqueOptions = options
      .map((o) => o.trim())
      .filter((o) => o && !normalizedExisting.includes(o.toLowerCase()));

    if (newUniqueOptions.length === 0) {
      return errorResponse(res, 409, "All provided options already exist.");
    }

    const updatedOptions = [...existingOptions, ...newUniqueOptions];

    const updateQuery = `
      UPDATE custom_field
      SET
        options = $1,
        updated_at = NOW(),
        updated_by = $2
      WHERE custom_field_id = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      updatedOptions,
      userId,
      custom_field_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Options added successfully."
    );
  } catch (error) {
    console.error("Create Option Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.deleteOption = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { custom_field_id } = req.params;
    const { options } = req.body;

    if (!custom_field_id || !Array.isArray(options) || options.length === 0) {
      return errorResponse(
        res,
        400,
        "custom_field_id (params) and options (array in body) are required."
      );
    }

    await client.query("BEGIN");

    const fieldQuery = `
      SELECT custom_field_id, field_type, options
      FROM custom_field
      WHERE custom_field_id = $1
        AND (
          (builder_id = $2 AND $2 IS NOT NULL)
          OR (company_id = $3 AND $3 IS NOT NULL)
        )
      FOR UPDATE;
    `;

    const fieldResult = await client.query(fieldQuery, [
      custom_field_id,
      builderId,
      companyId,
    ]);

    if (fieldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Custom field not found.");
    }

    const field = fieldResult.rows[0];

    if (field.field_type !== "list") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Options can only be deleted from list type fields."
      );
    }

    let existingOptions = field.options || [];

    const optionsToDelete = options.map((o) => o.toLowerCase());

    const filteredOptions = existingOptions.filter(
      (opt) => !optionsToDelete.includes(opt.toLowerCase())
    );

    if (filteredOptions.length === existingOptions.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "None of the provided options exist.");
    }

    const updateQuery = `
      UPDATE custom_field
      SET
        options = $1,
        updated_at = NOW(),
        updated_by = $2
      WHERE custom_field_id = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      filteredOptions,
      userId,
      custom_field_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Option(s) deleted successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Option Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
