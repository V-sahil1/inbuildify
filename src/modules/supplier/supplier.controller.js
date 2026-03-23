import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

export async function createSupplier(req, res) {
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
      work_cover_url,
      pl_insurance_url,
      white_card_url,
      fork_lift_license_url,
      trade_license_url,
      induction_pack_received,
      induction_pack_url,
    } = req.body || {};

    // Handle file uploads with fallback to URLs
    const finalWorkCoverUrl =
      req.files?.workCoverImage?.[0]?.location || work_cover_url || null;
    const finalPlInsuranceUrl =
      req.files?.plInsuranceImage?.[0]?.location || pl_insurance_url || null;
    const finalWhiteCardUrl =
      req.files?.whiteCardImage?.[0]?.location || white_card_url || null;
    const finalForkLiftLicenseUrl =
      req.files?.forkLiftLicenseImage?.[0]?.location ||
      fork_lift_license_url ||
      null;
    const finalTradeLicenseUrl =
      req.files?.tradeLicenseImage?.[0]?.location || trade_license_url || null;
    const finalInductionPackUrl =
      req.files?.inductionPackImage?.[0]?.location ||
      induction_pack_url ||
      null;

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
      "SELECT supplier_id FROM supplier WHERE company_id = $1 AND builder_id = $2 AND company_name = $3 LIMIT 1",
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
        "SELECT state_id FROM state WHERE state_id = $1 LIMIT 1",
        [state_id],
      );

      if (checkState.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id");
      }
    }

    // Validate supplier_type_id if provided
    if (supplier_type_id && supplier_type_id.length > 0) {
      // Check if all supplier_type_id values are valid UUIDs and exist in supplier_type table
      const checkSupplierTypes = await client.query(
        "SELECT supplier_type_id FROM supplier_type WHERE supplier_type_id = ANY($1::uuid[]) AND is_active = true AND (builder_id = $2 OR company_id = $3)",
        [supplier_type_id, builderId, companyId],
      );

      if (checkSupplierTypes.rowCount !== supplier_type_id.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more supplier_type_id values are invalid or inactive",
        );
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
        work_cover_url,
        pl_insurance_url,
        white_card_url,
        fork_lift_license_url,
        trade_license_url,
        induction_pack_received,
        induction_pack_url,
        created_by,
        updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
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
      finalWorkCoverUrl,
      finalPlInsuranceUrl,
      finalWhiteCardUrl,
      finalForkLiftLicenseUrl,
      finalTradeLicenseUrl,
      induction_pack_received !== undefined ? induction_pack_received : false,
      finalInductionPackUrl,
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
        s.work_cover_url,
        s.pl_insurance_url,
        s.white_card_url,
        s.fork_lift_license_url,
        s.trade_license_url,
        s.induction_pack_received,
        s.induction_pack_url,
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

    // Handle supplier contacts if provided
    const createdContacts = [];

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

    // Commit everything only after all operations are successful
    await client.query("COMMIT");

    return successResponse(
      res,
      {
        supplier: keysToCamelCase(responseResult.rows[0]),
        contacts: keysToCamelCase(createdContacts),
      },
      "Supplier created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating supplier:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllSuppliers(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const {
      company_name,
      phone,
      email,
      website,
      status,
      induction,
      supplier_type_id,
    } = req.query;

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

    if (status !== undefined) {
      conditions.push(`s.status = $${index++}`);
      values.push(status === "true");
    }

    if (induction !== undefined) {
      conditions.push(`s.induction_pack_received = $${index++}`);
      values.push(induction === "true");
    }

    if (supplier_type_id) {
      conditions.push(`$${index} = ANY(s.supplier_type_id)`);
      values.push(supplier_type_id);
      index++;
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
        s.work_cover_url,
        s.pl_insurance_url,
        s.white_card_url,
        s.fork_lift_license_url,
        s.trade_license_url,
        s.induction_pack_received,
        s.induction_pack_url,
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
}

export async function deleteSupplier(req, res) {
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
}

export async function updateSupplier(req, res) {
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
      work_cover_url,
      pl_insurance_url,
      white_card_url,
      fork_lift_license_url,
      trade_license_url,
      induction_pack_received,
      induction_pack_url,
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
      "work_cover_url",
      "pl_insurance_url",
      "white_card_url",
      "fork_lift_license_url",
      "trade_license_url",
      "induction_pack_received",
      "induction_pack_url",
    ];

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
        "SELECT state_id FROM state WHERE state_id = $1 LIMIT 1",
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
          "SELECT supplier_type_id FROM supplier_type WHERE supplier_type_id = ANY($1::uuid[]) AND is_active = true AND (builder_id = $2 OR company_id = $3)",
          [supplier_type_id, builderId, companyId],
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

    if (company_name !== undefined) {
      push("company_name", company_name.trim());
    }
    if (abn !== undefined) {
      push("abn", abn);
    }
    if (description !== undefined) {
      push("description", description);
    }
    if (contact_name !== undefined) {
      push("contact_name", contact_name);
    }
    if (primary_phone !== undefined) {
      push("primary_phone", primary_phone);
    }
    if (secondary_phone !== undefined) {
      push("secondary_phone", secondary_phone);
    }
    if (website !== undefined) {
      push("website", website);
    }
    if (address_line1 !== undefined) {
      push("address_line1", address_line1);
    }
    if (city !== undefined) {
      push("city", city);
    }
    if (state_id !== undefined) {
      push("state_id", state_id);
    }
    if (zip_code !== undefined) {
      push("zip_code", zip_code);
    }
    if (lead_time !== undefined) {
      push("lead_time", lead_time);
    }

    const finalWorkCoverUrl =
      req.files?.workCoverImage?.[0]?.location || work_cover_url;
    const finalPlInsuranceUrl =
      req.files?.plInsuranceImage?.[0]?.location || pl_insurance_url;
    const finalWhiteCardUrl =
      req.files?.whiteCardImage?.[0]?.location || white_card_url;
    const finalForkLiftLicenseUrl =
      req.files?.forkLiftLicenseImage?.[0]?.location || fork_lift_license_url;
    const finalTradeLicenseUrl =
      req.files?.tradeLicenseImage?.[0]?.location || trade_license_url;
    const finalInductionPackUrl =
      req.files?.inductionPackImage?.[0]?.location || induction_pack_url;

    // Handle S3 cleanup for document URLs
    if (
      finalWorkCoverUrl !== undefined &&
      oldSupplier.work_cover_url &&
      oldSupplier.work_cover_url !== finalWorkCoverUrl
    ) {
      await deleteFromS3(oldSupplier.work_cover_url).catch((err) => {
        console.error("Error deleting old work cover from S3:", err);
      });
    }
    if (
      finalPlInsuranceUrl !== undefined &&
      oldSupplier.pl_insurance_url &&
      oldSupplier.pl_insurance_url !== finalPlInsuranceUrl
    ) {
      await deleteFromS3(oldSupplier.pl_insurance_url).catch((err) => {
        console.error("Error deleting old PL insurance from S3:", err);
      });
    }
    if (
      finalWhiteCardUrl !== undefined &&
      oldSupplier.white_card_url &&
      oldSupplier.white_card_url !== finalWhiteCardUrl
    ) {
      await deleteFromS3(oldSupplier.white_card_url).catch((err) => {
        console.error("Error deleting old white card from S3:", err);
      });
    }
    if (
      finalForkLiftLicenseUrl !== undefined &&
      oldSupplier.fork_lift_license_url &&
      oldSupplier.fork_lift_license_url !== finalForkLiftLicenseUrl
    ) {
      await deleteFromS3(oldSupplier.fork_lift_license_url).catch((err) => {
        console.error("Error deleting old fork lift license from S3:", err);
      });
    }
    if (
      finalTradeLicenseUrl !== undefined &&
      oldSupplier.trade_license_url &&
      oldSupplier.trade_license_url !== finalTradeLicenseUrl
    ) {
      await deleteFromS3(oldSupplier.trade_license_url).catch((err) => {
        console.error("Error deleting old trade license from S3:", err);
      });
    }
    if (
      finalInductionPackUrl !== undefined &&
      oldSupplier.induction_pack_url &&
      oldSupplier.induction_pack_url !== finalInductionPackUrl
    ) {
      await deleteFromS3(oldSupplier.induction_pack_url).catch((err) => {
        console.error("Error deleting old induction pack from S3:", err);
      });
    }

    if (finalWorkCoverUrl !== undefined) {
      push("work_cover_url", finalWorkCoverUrl);
    }
    if (finalPlInsuranceUrl !== undefined) {
      push("pl_insurance_url", finalPlInsuranceUrl);
    }
    if (finalWhiteCardUrl !== undefined) {
      push("white_card_url", finalWhiteCardUrl);
    }
    if (finalForkLiftLicenseUrl !== undefined) {
      push("fork_lift_license_url", finalForkLiftLicenseUrl);
    }
    if (finalTradeLicenseUrl !== undefined) {
      push("trade_license_url", finalTradeLicenseUrl);
    }
    if (induction_pack_received !== undefined) {
      push("induction_pack_received", induction_pack_received);
    }
    if (finalInductionPackUrl !== undefined) {
      push("induction_pack_url", finalInductionPackUrl);
    }

    if (statusInBody) {
      push("status", requestedStatus);
    }

    if (sanitizedEmails !== null) {
      push("emails", sanitizedEmails);
    }
    if (supplier_type_id !== undefined) {
      push("supplier_type_id", supplier_type_id);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    push("updated_by", userId);
    fields.push("updated_at = NOW()");

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
        s.work_cover_url,
        s.pl_insurance_url,
        s.white_card_url,
        s.fork_lift_license_url,
        s.trade_license_url,
        s.induction_pack_received,
        s.induction_pack_url,
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
}
