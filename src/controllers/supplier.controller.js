const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createSupplier = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const {
      company_name,
      abn,
      description,
      contact_name,
      primary_phone,
      secondary_phone,
      website,
      address_line1,
      city,
      state_id,
      zip_code,
      lead_time,
      status,
      emails,
      supplier_type_id,
    } = req.body;

    await client.query("BEGIN");

    if (!company_name) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "company_name is required");
    }

    // Validate supplier_type_id if provided
    if (supplier_type_id) {
      if (!Array.isArray(supplier_type_id)) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "supplier_type_id must be an array of UUIDs",
        );
      }

      if (supplier_type_id.length > 0) {
        // Check if all supplier_type_id values are valid UUIDs and exist in supplier_type table
        const checkSupplierTypes = await client.query(
          `SELECT supplier_type_id FROM supplier_type WHERE supplier_type_id = ANY($1::uuid[])`,
          [supplier_type_id],
        );

        if (checkSupplierTypes.rowCount !== supplier_type_id.length) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "One or more supplier_type_id values are invalid",
          );
        }
      }
    }

    const checkUnique = await client.query(
      `SELECT supplier_id FROM supplier WHERE company_id = $1 AND builder_id = $2 AND company_name = $3 LIMIT 1`,
      [companyId, builderId, company_name],
    );

    if (checkUnique.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Supplier with this company_name already exists for this builder.",
      );
    }

    if (state_id) {
      const checkState = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1 LIMIT 1`,
        [state_id],
      );

      if (checkState.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id");
      }
    }

    let sanitizedEmails = null;
    if (emails) {
      if (!Array.isArray(emails)) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "emails must be an array of strings");
      }
      const invalidEmail = emails.find(
        (e) => typeof e !== "string" || !e.includes("@"),
      );
      if (invalidEmail) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, `Invalid email: ${invalidEmail}`);
      }
      sanitizedEmails = emails;
    }

    const insertQuery = `
      INSERT INTO supplier (
        company_id,
        builder_id,
        supplier_type_id,
        company_name,
        abn,
        description,
        contact_name,
        primary_phone,
        secondary_phone,
        website,
        address_line1,
        city,
        state_id,
        zip_code,
        lead_time,
        status,
        emails,
        created_by,
        updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      supplier_type_id || [],
      company_name,
      abn || null,
      description || null,
      contact_name || null,
      primary_phone || null,
      secondary_phone || null,
      website || null,
      address_line1 || null,
      city || null,
      state_id || null,
      zip_code || null,
      lead_time || null,
      status !== undefined ? status : true,
      sanitizedEmails,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    // Fetch the created supplier with supplier_type details
    const supplierId = result.rows[0].supplier_id;
    const responseQuery = `
      SELECT 
        s.supplier_id,
        s.company_id,
        s.builder_id,
        s.company_name,
        s.abn,
        s.description,
        s.contact_name,
        s.primary_phone,
        s.secondary_phone,
        s.website,
        s.address_line1,
        s.city,
        s.state_id,
        s.zip_code,
        s.lead_time,
        s.status,
        s.emails,
        COALESCE(
          json_agg(
            json_build_object(
              'id', st.supplier_type_id,
              'name', st.name
              ) ORDER BY st.name
              ) FILTER (WHERE st.supplier_type_id IS NOT NULL), 
              '[]'
              ) as supplier_types,
              s.created_by,
              s.updated_by,
              s.created_at,
              s.updated_at
      FROM supplier s
      LEFT JOIN supplier_type st ON st.supplier_type_id = ANY(s.supplier_type_id)
      WHERE s.supplier_id = $1
      GROUP BY s.supplier_id
    `;

    const responseResult = await client.query(responseQuery, [supplierId]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Supplier created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating supplier:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllSuppliers = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    let {
      page = 1,
      limit = 25,
      company_name,
      phone,
      email,
      website,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    const conditions = [];
    const values = [];
    let index = 1;

    conditions.push(`s.company_id = $${index++}`);
    values.push(companyId);
    conditions.push(`s.builder_id = $${index++}`);
    values.push(builderId);

    if (company_name) {
      conditions.push(`s.company_name ILIKE $${index++}`);
      values.push(`%${company_name}%`);
    }

    if (phone) {
      conditions.push(
        `(s.primary_phone ILIKE $${index} OR s.secondary_phone ILIKE $${index++})`,
      );
      values.push(`%${phone}%`);
    }

    if (email) {
      conditions.push(`$${index} = ANY(s.emails)`);
      values.push(email);
      index++;
    }

    if (website) {
      conditions.push(`s.website ILIKE $${index++}`);
      values.push(`%${website}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countQuery = `SELECT COUNT(*) AS total FROM supplier s ${whereClause}`;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    const mainQuery = `
      SELECT 
        s.supplier_id,
        s.company_id,
        s.builder_id,
        s.company_name,
        s.abn,
        s.description,
        s.contact_name,
        s.primary_phone,
        s.secondary_phone,
        s.website,
        s.address_line1,
        s.city,
        s.state_id,
        s.zip_code,
        s.lead_time,
        s.status,
        s.emails,
        COALESCE(
          json_agg(
            json_build_object(
              'id', st.supplier_type_id,
              'name', st.name
              ) ORDER BY st.name
              ) FILTER (WHERE st.supplier_type_id IS NOT NULL), 
              '[]'
              ) as supplier_types,
              s.created_by,
              s.updated_by,
              s.created_at,
              s.updated_at
      FROM supplier s
      LEFT JOIN supplier_type st ON st.supplier_type_id = ANY(s.supplier_type_id)
      ${whereClause}
      GROUP BY s.supplier_id
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const result = await client.query(mainQuery, values);

    return successResponse(
      res,
      {
        suppliers: keysToCamelCase(result.rows),
        totalRecords: total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      "Suppliers fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSupplier = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { supplier_id } = req.params;

    const checkQuery = `
      SELECT supplier_id
      FROM supplier
      WHERE supplier_id = $1 AND company_id = $2 AND builder_id = $3
      LIMIT 1
    `;
    const checkResult = await client.query(checkQuery, [
      supplier_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Supplier not found or you are not authorized to delete it.",
      );
    }

    const deleteQuery = `
      DELETE FROM supplier
      WHERE supplier_id = $1 AND company_id = $2 AND builder_id = $3
    `;
    await client.query(deleteQuery, [supplier_id, companyId, builderId]);

    return successResponse(res, null, "Supplier deleted successfully.");
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSupplier = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { supplier_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId && !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    const {
      company_name,
      abn,
      description,
      contact_name,
      primary_phone,
      secondary_phone,
      website,
      address_line1,
      city,
      state_id,
      zip_code,
      lead_time,
      status,
      emails,
      supplier_type_id,
    } = req.body;

    const checkQuery = `
      SELECT * FROM supplier
      WHERE supplier_id = $1
        AND (builder_id = $2 OR company_id = $3)
      LIMIT 1 FOR UPDATE;
    `;
    const checkResult = await client.query(checkQuery, [
      supplier_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Supplier not found or not owned by this builder/company.",
      );
    }

    const oldSupplier = checkResult.rows[0];
    const currentStatus = oldSupplier.status;
    const statusInBody = req.body.status !== undefined;
    const requestedStatus = status;

    const fieldsToCheck = [
      "company_name",
      "abn",
      "description",
      "contact_name",
      "primary_phone",
      "secondary_phone",
      "website",
      "address_line1",
      "city",
      "state_id",
      "zip_code",
      "lead_time",
      "emails",
      "supplier_type_id",
    ];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'status' field must be a boolean (true or false).",
      );
    }

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active supplier, 'status' must be the only field provided in the request.",
        );
      }
    }

    if (currentStatus === false) {
      if (statusInBody && requestedStatus === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive supplier, 'status' must be the only field provided in the request.",
          );
        }
      }

      const performingActivation = statusInBody && requestedStatus === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'status' fields when the supplier is currently Inactive. Only 'status' can be changed (to true/Active).",
        );
      }

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Supplier is already Inactive. 'status' can only be updated to true (Active) from this state.",
        );
      }
    }

    if (company_name) {
      const duplicateName = await client.query(
        `SELECT supplier_id FROM supplier
            WHERE LOWER(company_name) = LOWER($1)
              AND company_id = $2
              AND builder_id = $3
              AND supplier_id != $4`,
        [company_name, companyId, builderId, supplier_id],
      );

      if (duplicateName.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "company name already exists for another record.",
        );
      }
    }

    if (state_id) {
      const checkState = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1 LIMIT 1`,
        [state_id],
      );

      if (checkState.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id");
      }
    }

    // Validate supplier_type_id if provided
    if (supplier_type_id !== undefined) {
      if (!Array.isArray(supplier_type_id)) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "supplier_type_id must be an array of UUIDs",
        );
      }

      if (supplier_type_id.length > 0) {
        // Check if all supplier_type_id values are valid UUIDs and exist in supplier_type table
        const checkSupplierTypes = await client.query(
          `SELECT supplier_type_id FROM supplier_type WHERE supplier_type_id = ANY($1::uuid[])`,
          [supplier_type_id],
        );

        if (checkSupplierTypes.rowCount !== supplier_type_id.length) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "One or more supplier_type_id values are invalid",
          );
        }
      }
    }

    let sanitizedEmails = null;
    if (emails !== undefined) {
      if (!Array.isArray(emails)) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "emails must be an array of strings.");
      }
      const invalidEmail = emails.find(
        (e) => typeof e !== "string" || !e.includes("@"),
      );
      if (invalidEmail) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, `Invalid email: ${invalidEmail}`);
      }
      sanitizedEmails = emails;
    }

    const fields = [];
    const values = [];
    let i = 1;

    const push = (column, value) => {
      fields.push(`${column} = $${i++}`);
      values.push(value);
    };

    if (company_name !== undefined) push("company_name", company_name.trim());
    if (abn !== undefined) push("abn", abn);
    if (description !== undefined) push("description", description);
    if (contact_name !== undefined) push("contact_name", contact_name);
    if (primary_phone !== undefined) push("primary_phone", primary_phone);
    if (secondary_phone !== undefined) push("secondary_phone", secondary_phone);
    if (website !== undefined) push("website", website);
    if (address_line1 !== undefined) push("address_line1", address_line1);
    if (city !== undefined) push("city", city);
    if (state_id !== undefined) push("state_id", state_id);
    if (zip_code !== undefined) push("zip_code", zip_code);
    if (lead_time !== undefined) push("lead_time", lead_time);

    if (statusInBody) push("status", requestedStatus);

    if (sanitizedEmails !== null) push("emails", sanitizedEmails);
    if (supplier_type_id !== undefined)
      push("supplier_type_id", supplier_type_id);

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    push("updated_by", userId);
    fields.push(`updated_at = NOW()`);

    const whereClauseValues = [supplier_id, builderId, companyId];

    const updateQuery = `
      UPDATE supplier
      SET ${fields.join(", ")}
      WHERE supplier_id = $${i++} AND (builder_id = $${i++} OR company_id = $${i})
      RETURNING *;
    `;

    values.push(...whereClauseValues);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Failed to update supplier.");
    }

    // Fetch the updated supplier with supplier_type details
    const responseQuery = `
      SELECT 
        s.supplier_id,
        s.company_id,
        s.builder_id,
        s.company_name,
        s.abn,
        s.description,
        s.contact_name,
        s.primary_phone,
        s.secondary_phone,
        s.website,
        s.address_line1,
        s.city,
        s.state_id,
        s.zip_code,
        s.lead_time,
        s.status,
        s.emails,
        COALESCE(
          json_agg(
            json_build_object(
              'id', st.supplier_type_id,
              'name', st.name
              ) ORDER BY st.name
              ) FILTER (WHERE st.supplier_type_id IS NOT NULL), 
              '[]'
              ) as supplier_types,
              s.created_by,
              s.updated_by,
              s.created_at,
              s.updated_at
      FROM supplier s
      LEFT JOIN supplier_type st ON st.supplier_type_id = ANY(s.supplier_type_id)
      WHERE s.supplier_id = $1
      GROUP BY s.supplier_id
    `;

    const responseResult = await client.query(responseQuery, [supplier_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Supplier updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating supplier:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};
