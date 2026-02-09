const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

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
      // Supplier contact details - now supporting multiple contacts
      contacts,
      // Supplier document details
      work_cover_image,
      pl_insurance_image,
      white_card_image,
      fork_lift_license_image,
      trade_license_image,
      induction_pack_image,
      induction_pack_received,
    } = req.body || {};

    await client.query("BEGIN");

    // Validate required fields
    if (!company_name) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "company_name is required");
    }

    if (supplier_type_id) {
      if (!Array.isArray(supplier_type_id)) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "supplier_type_id must be an array of UUIDs",
        );
      }
    }

    // Check for duplicate company name
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

    // Validate state if provided
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

    // Validate emails if provided
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

    // Insert supplier
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
      state_id,
      zip_code || null,
      lead_time || null,
      status !== undefined ? status : true,
      sanitizedEmails,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

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

    // Handle supplier contacts if provided
    let createdContacts = [];

    // Parse contacts if it's a string
    let parsedContacts = contacts;
    if (typeof contacts === "string") {
      try {
        parsedContacts = JSON.parse(contacts);
      } catch (e) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid contacts format. Must be valid JSON array.",
        );
      }
    }

    if (
      parsedContacts &&
      Array.isArray(parsedContacts) &&
      parsedContacts.length > 0
    ) {
      // Validate each contact
      for (const contact of parsedContacts) {
        if (!contact.contact_name && !contact.phone && !contact.email) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "Each contact must have at least one of: contact_name, phone, or email",
          );
        }
      }

      // Insert all contacts
      const contactInsertQuery = `
        INSERT INTO supplier_contacts (
          supplier_id,
          contact_name,
          phone,
          email,
          contact_type
        ) VALUES ($1,$2,$3,$4,$5)
        RETURNING *;
      `;

      for (const contact of parsedContacts) {
        const contactValues = [
          supplierId,
          contact.contact_name || null,
          contact.phone || null,
          contact.email || null,
          contact.contact_type || null,
        ];

        const contactResult = await client.query(
          contactInsertQuery,
          contactValues,
        );
        createdContacts.push(...contactResult.rows);
      }
    }

    // Handle supplier documents if provided
    let documents = [];
    if (
      work_cover_image ||
      pl_insurance_image ||
      white_card_image ||
      fork_lift_license_image ||
      trade_license_image ||
      (induction_pack_image &&
        (induction_pack_received || induction_pack_received === "true")) ||
      induction_pack_received === "true"
    ) {
      const work_cover_url =
        req.files?.workCoverImage?.[0]?.location ||
        req.body.work_cover_image ||
        null;
      const pl_insurance_url =
        req.files?.plInsuranceImage?.[0]?.location ||
        req.body.pl_insurance_image ||
        null;
      const white_card_url =
        req.files?.whiteCardImage?.[0]?.location ||
        req.body.white_card_image ||
        null;
      const fork_lift_license_url =
        req.files?.forkLiftLicenseImage?.[0]?.location ||
        req.body.fork_lift_license_image ||
        null;
      const trade_license_url =
        req.files?.tradeLicenseImage?.[0]?.location ||
        req.body.trade_license_image ||
        null;
      const induction_pack_url =
        req.files?.inductionPackImage?.[0]?.location ||
        req.body.induction_pack_image ||
        null;

      const inductionBoolean =
        induction_pack_received === true || induction_pack_received === "true";

      if (inductionBoolean && !induction_pack_url) {
        return errorResponse(
          res,
          400,
          "induction_pack_url is required when induction_pack_received is true.",
        );
      }

      if (!inductionBoolean && induction_pack_url) {
        return errorResponse(
          res,
          400,
          "You cannot provide induction_pack_url when induction_pack_received is false.",
        );
      }

      const docInsertQuery = `
        INSERT INTO supplier_documents (
          supplier_id,
         
          work_cover_url,
          pl_insurance_url,
          white_card_url,
          fork_lift_license_url,
          trade_license_url,
          induction_pack_received,
          induction_pack_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *;
      `;

      const docValues = [
        supplierId,

        work_cover_url,
        pl_insurance_url,
        white_card_url,
        fork_lift_license_url,
        trade_license_url,
        inductionBoolean,
        induction_pack_url,
      ];

      const docResult = await client.query(docInsertQuery, docValues);
      documents = docResult.rows;
    }

    return successResponse(
      res,
      {
        supplier: keysToCamelCase(responseResult.rows[0]),
        contacts: keysToCamelCase(createdContacts),
        documents: keysToCamelCase(documents),
      },
      "Supplier, contacts, and documents created successfully.",
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

    let { company_name, phone, email, website } = req.query;

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
    `;
    const result = await client.query(mainQuery, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
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

    await client.query("BEGIN");

    // Remove supplier_id from all color_category records that reference it
    const updateColorCategoriesQuery = `
      UPDATE color_category 
      SET suppliers = array_remove(suppliers, $1)
      WHERE $1 = ANY(suppliers)
    `;

    await client.query(updateColorCategoriesQuery, [supplier_id]);

    // Delete the supplier
    const deleteQuery = `
      DELETE FROM supplier
      WHERE supplier_id = $1 AND company_id = $2 AND builder_id = $3
    `;
    await client.query(deleteQuery, [supplier_id, companyId, builderId]);

    await client.query("COMMIT");

    return successResponse(res, null, "Supplier deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
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

    // if (statusInBody && typeof requestedStatus !== "boolean") {
    //   await client.query("ROLLBACK");
    //   return errorResponse(
    //     res,
    //     400,
    //     "The 'status' field must be a boolean (true or false).",
    //   );
    // }

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

    // Handle supplier documents if provided
    let documents = [];
    const {
      work_cover_image,
      pl_insurance_image,
      white_card_image,
      fork_lift_license_image,
      trade_license_image,
      induction_pack_image,
      induction_pack_received,
    } = req.body;

    if (
      work_cover_image ||
      pl_insurance_image ||
      white_card_image ||
      fork_lift_license_image ||
      trade_license_image ||
      (induction_pack_image &&
        (induction_pack_received || induction_pack_received === "true")) ||
      induction_pack_received === "true" ||
      req.files?.workCoverImage ||
      req.files?.plInsuranceImage ||
      req.files?.whiteCardImage ||
      req.files?.forkLiftLicenseImage ||
      req.files?.tradeLicenseImage ||
      req.files?.inductionPackImage
    ) {
      // Check if documents already exist for this supplier
      const existingDocsQuery = `
        SELECT * FROM supplier_documents 
        WHERE supplier_id = $1
      `;
      const existingDocsResult = await client.query(existingDocsQuery, [
        supplier_id,
      ]);

      const work_cover_url =
        req.files?.workCoverImage?.[0]?.location || req.body.work_cover_image;
      const pl_insurance_url =
        req.files?.plInsuranceImage?.[0]?.location ||
        req.body.pl_insurance_image;
      const white_card_url =
        req.files?.whiteCardImage?.[0]?.location || req.body.white_card_image;
      const fork_lift_license_url =
        req.files?.forkLiftLicenseImage?.[0]?.location ||
        req.body.fork_lift_license_image;
      const trade_license_url =
        req.files?.tradeLicenseImage?.[0]?.location ||
        req.body.trade_license_image;
      const induction_pack_url =
        req.files?.inductionPackImage?.[0]?.location ||
        req.body.induction_pack_image;

      const inductionBoolean =
        induction_pack_received === true || induction_pack_received === "true";

      if (inductionBoolean && !induction_pack_url) {
        return errorResponse(
          res,
          400,
          "induction_pack_url is required when induction_pack_received is true.",
        );
      }

      if (!inductionBoolean && induction_pack_url) {
        return errorResponse(
          res,
          400,
          "You cannot provide induction_pack_url when induction_pack_received is false.",
        );
      }

      if (existingDocsResult.rowCount > 0) {
        const existingDocs = existingDocsResult.rows[0];

        // Update existing documents with S3 cleanup
        const docUpdateFields = [];
        const docValues = [];
        let docIndex = 1;

        const pushDoc = (field, value, existingValue) => {
          if (value !== undefined && value !== null) {
            // Delete old image from S3 if it exists and is different from new one
            if (existingValue && existingValue !== value) {
              deleteFromS3(existingValue).catch((err) => {
                console.error("Error deleting old image from S3:", err);
              });
            }
            docUpdateFields.push(`${field} = $${docIndex++}`);
            docValues.push(value);
          }
        };

        pushDoc("work_cover_url", work_cover_url, existingDocs.work_cover_url);
        pushDoc(
          "pl_insurance_url",
          pl_insurance_url,
          existingDocs.pl_insurance_url,
        );
        pushDoc("white_card_url", white_card_url, existingDocs.white_card_url);
        pushDoc(
          "fork_lift_license_url",
          fork_lift_license_url,
          existingDocs.fork_lift_license_url,
        );
        pushDoc(
          "trade_license_url",
          trade_license_url,
          existingDocs.trade_license_url,
        );

        if (induction_pack_received !== undefined) {
          docUpdateFields.push(`induction_pack_received = $${docIndex++}`);
          docValues.push(inductionBoolean);

          // Handle induction pack URL specifically
          if (induction_pack_url !== undefined && induction_pack_url !== null) {
            if (
              existingDocs.induction_pack_url &&
              existingDocs.induction_pack_url !== induction_pack_url
            ) {
              deleteFromS3(existingDocs.induction_pack_url).catch((err) => {
                console.error(
                  "Error deleting old induction pack from S3:",
                  err,
                );
              });
            }
            docUpdateFields.push(`induction_pack_url = $${docIndex++}`);
            docValues.push(induction_pack_url);
          }
        } else if (
          induction_pack_url !== undefined &&
          induction_pack_url !== null
        ) {
          // If only induction_pack_url is provided (without induction_pack_received)
          if (
            existingDocs.induction_pack_url &&
            existingDocs.induction_pack_url !== induction_pack_url
          ) {
            deleteFromS3(existingDocs.induction_pack_url).catch((err) => {
              console.error("Error deleting old induction pack from S3:", err);
            });
          }
          docUpdateFields.push(`induction_pack_url = $${docIndex++}`);
          docValues.push(induction_pack_url);
        }

        if (docUpdateFields.length > 0) {
          docUpdateFields.push(`updated_at = NOW()`);
          docValues.push(supplier_id);

          const docUpdateQuery = `
            UPDATE supplier_documents 
            SET ${docUpdateFields.join(", ")}
            WHERE supplier_id = $${docIndex}
            RETURNING *;
          `;

          const docUpdateResult = await client.query(docUpdateQuery, docValues);
          documents = docUpdateResult.rows;
        } else {
          documents = existingDocsResult.rows;
        }
      } else {
        // Insert new documents
        const docInsertQuery = `
          INSERT INTO supplier_documents (
            supplier_id,
            work_cover_url,
            pl_insurance_url,
            white_card_url,
            fork_lift_license_url,
            trade_license_url,
            induction_pack_received,
            induction_pack_url
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING *;
        `;

        const docValues = [
          supplier_id,
          work_cover_url,
          pl_insurance_url,
          white_card_url,
          fork_lift_license_url,
          trade_license_url,
          inductionBoolean,
          induction_pack_url,
        ];

        const docResult = await client.query(docInsertQuery, docValues);
        documents = docResult.rows;
      }
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
      {
        supplier: keysToCamelCase(responseResult.rows[0]),
        documents: keysToCamelCase(documents),
      },
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
