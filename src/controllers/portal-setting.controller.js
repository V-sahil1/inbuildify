const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createPortalSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const {
      send_login_credentials_to_customer,
      portal_active_days_after_handover,
      send_mail_when_portal_inactive,
      show_site_supervisor_details,
      show_balance_to_pay,
      add_notes_enabled,
      allow_color_selection,
      show_color_cost,
      show_construction_stages,
      auto_share_site_images,
      show_progress_tab,
      publish_packages_to_agent_portal,
    } = req.body;
    const default_facade_image =
      req.files?.location || req.body.default_facade_image || null;

    const isFieldTrue = (fieldValue) => {
      if (typeof fieldValue === "string") {
        return fieldValue.toLowerCase() === "true";
      }
      return fieldValue === true;
    };

    const strictLoginCredsValue = isFieldTrue(
      req.body.send_login_credentials_to_customer
    );

    const isAllowColorSelectionTrue = isFieldTrue(allow_color_selection);
    const isShowConstructionStagesTrue = isFieldTrue(show_construction_stages);

    const duplicateQuery = `
      SELECT portal_settings_id
      FROM portal_settings
      WHERE (builder_id IS NOT NULL AND builder_id = $1)
         OR (company_id IS NOT NULL AND company_id = $2)
    `;
    const duplicateResult = await client.query(duplicateQuery, [
      builderId,
      companyId,
    ]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "Portal settings already exist for this builder/company."
      );
    }

    const isLoginCredsFalse = !strictLoginCredsValue;

    if (isLoginCredsFalse) {
      const forbiddenFields = [
        "portal_active_days_after_handover",
        "send_mail_when_portal_inactive",
        "show_site_supervisor_details",
        "show_balance_to_pay",
        "add_notes_enabled",
        "allow_color_selection",
        "show_color_cost",
        "show_construction_stages",
        "auto_share_site_images",
        "show_progress_tab",
        "default_facade_image",
      ];

      for (const fieldName of forbiddenFields) {
        if (fieldName in req.body) {
          return errorResponse(
            res,
            400,
            `Field ${fieldName} cannot be defined when 'send_login_credentials_to_customer' is false. Only 'publish_packages_to_agent_portal' is allowed.`
          );
        }
      }
    }

    if (!isAllowColorSelectionTrue && "show_color_cost" in req.body) {
      return errorResponse(
        res,
        400,
        "Cannot define 'show_color_cost' unless 'allow_color_selection' is explicitly set to true."
      );
    }

    if (!isShowConstructionStagesTrue && "auto_share_site_images" in req.body) {
      return errorResponse(
        res,
        400,
        "Cannot define 'auto_share_site_images' unless 'show_construction_stages' is explicitly set to true."
      );
    }

    if (
      portal_active_days_after_handover !== undefined &&
      portal_active_days_after_handover < 0
    ) {
      return errorResponse(
        res,
        400,
        "'portal_active_days_after_handover' must be greater than or equal to 0."
      );
    }

    const insertQuery = `
      INSERT INTO portal_settings (
        company_id, builder_id, send_login_credentials_to_customer,
        portal_active_days_after_handover, send_mail_when_portal_inactive,
        show_site_supervisor_details, show_balance_to_pay, add_notes_enabled,
        allow_color_selection, show_color_cost, show_construction_stages,
        auto_share_site_images, show_progress_tab, default_facade_image,
        publish_packages_to_agent_portal, created_by, updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16
      )
      RETURNING *;
    `;

    const insertValues = [
      companyId,
      builderId,
      send_login_credentials_to_customer || false,
      portal_active_days_after_handover,
      send_mail_when_portal_inactive || false,
      show_site_supervisor_details || false,
      show_balance_to_pay || false,
      add_notes_enabled || false,
      allow_color_selection || false,
      show_color_cost || false,
      show_construction_stages || false,
      auto_share_site_images || false,
      show_progress_tab || false,
      default_facade_image,
      publish_packages_to_agent_portal || false,
      userId,
    ];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Portal settings created successfully."
    );
  } catch (error) {
    console.error("Error creating portal settings:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updatePortalSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const isFieldTrue = (fieldValue) => {
    if (typeof fieldValue === "string") {
      return fieldValue.toLowerCase() === "true";
    }
    return fieldValue === true;
  };

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const updatedBy = req.user?.user_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Builder or Company ID missing."
      );
    }

    const requestBody =
      req.body && typeof req.body === "object" ? req.body : {};

    await client.query("BEGIN");

    const checkQuery = `
      SELECT * FROM portal_settings 
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1;
    `;
    const existing = await client.query(checkQuery, [builderId, companyId]);

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Portal settings not found. Please create portal settings first."
      );
    }

    const existingData = existing.rows[0];

    const mergedData = { ...existingData, ...requestBody };

    const {
      send_login_credentials_to_customer,
      portal_active_days_after_handover,
      send_mail_when_portal_inactive,
      show_site_supervisor_details,
      show_balance_to_pay,
      add_notes_enabled,
      allow_color_selection,
      show_color_cost,
      show_construction_stages,
      auto_share_site_images,
      show_progress_tab,
      publish_packages_to_agent_portal,
    } = mergedData;

    const isLoginCredsTrue = isFieldTrue(send_login_credentials_to_customer);
    const isAllowColorSelectionTrue = isFieldTrue(allow_color_selection);
    const isShowConstructionStagesTrue = isFieldTrue(show_construction_stages);

    if (!isLoginCredsTrue) {
      const forbiddenFields = [
        "portal_active_days_after_handover",
        "send_mail_when_portal_inactive",
        "show_site_supervisor_details",
        "show_balance_to_pay",
        "add_notes_enabled",
        "allow_color_selection",
        "show_color_cost",
        "show_construction_stages",
        "auto_share_site_images",
        "show_progress_tab",
        "default_facade_image",
      ];

      for (const fieldName of forbiddenFields) {
        if (Object.prototype.hasOwnProperty.call(requestBody, fieldName)) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            `Field ${fieldName} cannot be defined when 'send_login_credentials_to_customer' is false. Only 'publish_packages_to_agent_portal' is allowed.`
          );
        }
      }
    }

    if (
      !isAllowColorSelectionTrue &&
      Object.prototype.hasOwnProperty.call(requestBody, "show_color_cost")
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot define 'show_color_cost' unless 'allow_color_selection' is explicitly set to true."
      );
    }

    if (
      !isShowConstructionStagesTrue &&
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "auto_share_site_images"
      )
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot define 'auto_share_site_images' unless 'show_construction_stages' is explicitly set to true."
      );
    }

    if (
      portal_active_days_after_handover !== undefined &&
      portal_active_days_after_handover < 0
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "'portal_active_days_after_handover' must be greater than or equal to 0."
      );
    }

    const shouldResetAll =
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "send_login_credentials_to_customer"
      ) && !isLoginCredsTrue;

    let oldFacadeImageUrl = existingData.default_facade_image;
    const portalSettingsId = existingData.portal_settings_id;

    if (shouldResetAll) {
      if (oldFacadeImageUrl) {
        await deleteFromS3(oldFacadeImageUrl);
        oldFacadeImageUrl = null;
      }

      const resetQuery = `
        UPDATE portal_settings
        SET 
          send_login_credentials_to_customer = FALSE,
          portal_active_days_after_handover = NULL,
          send_mail_when_portal_inactive = FALSE,
          show_site_supervisor_details = FALSE,
          show_balance_to_pay = FALSE,
          add_notes_enabled = FALSE,
          allow_color_selection = FALSE,
          show_color_cost = FALSE,
          show_construction_stages = FALSE,
          auto_share_site_images = FALSE,
          show_progress_tab = FALSE,
          default_facade_image = NULL,
          updated_by = $2,
          updated_at = NOW()
        WHERE portal_settings_id = $1;
      `;

      await client.query(resetQuery, [portalSettingsId, updatedBy]);

      if (
        Object.prototype.hasOwnProperty.call(
          requestBody,
          "publish_packages_to_agent_portal"
        )
      ) {
        const pubPackageQuery = `
              UPDATE portal_settings
              SET publish_packages_to_agent_portal = $2
              WHERE portal_settings_id = $1;
            `;
        await client.query(pubPackageQuery, [
          portalSettingsId,
          requestBody.publish_packages_to_agent_portal,
        ]);
      }

      const finalResult = await client.query(checkQuery, [
        builderId,
        companyId,
      ]);
      await client.query("COMMIT");

      return successResponse(
        res,
        keysToCamelCase(finalResult.rows[0]),
        "Portal settings reset and updated successfully due to login credentials being disabled."
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    const updatableKeys = [
      "send_login_credentials_to_customer",
      "portal_active_days_after_handover",
      "send_mail_when_portal_inactive",
      "show_site_supervisor_details",
      "show_balance_to_pay",
      "add_notes_enabled",
      "allow_color_selection",
      "show_color_cost",
      "show_construction_stages",
      "auto_share_site_images",
      "show_progress_tab",
      "publish_packages_to_agent_portal",
    ];

    for (const key of updatableKeys) {
      if (Object.prototype.hasOwnProperty.call(requestBody, key)) {
        fields.push(`${key} = $${i++}`);
        values.push(requestBody[key]);
      }
    }

    // --- S3 Deletion Logic for default_facade_image ---
    if (
      Object.prototype.hasOwnProperty.call(requestBody, "default_facade_image")
    ) {
      const newImage = requestBody.default_facade_image || null;

      if (
        existingData.default_facade_image && // If there is an existing image
        existingData.default_facade_image !== newImage // AND the new image is different (including null)
      ) {
        await deleteFromS3(existingData.default_facade_image);
      }

      fields.push(`default_facade_image = $${i++}`);
      values.push(newImage);
      oldFacadeImageUrl = newImage; // Update tracking variable for the return data
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(updatedBy);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE portal_settings
      SET ${fields.join(", ")}
      WHERE portal_settings_id = $${i} 
        AND (builder_id = $${i + 1} OR company_id = $${i + 2})
      RETURNING *;
    `;

    values.push(portalSettingsId, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Portal settings updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating portal settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPortalSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id } = req.user;

    if (!company_id && !builder_id) {
      return errorResponse(res, 400, "Invalid user context.");
    }

    let result = await client.query(
      `
      SELECT *
      FROM portal_settings
      WHERE company_id = $1 AND builder_id = $2
      LIMIT 1
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO portal_settings (company_id, builder_id, created_by, updated_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [company_id, builder_id, req.user.user_id, req.user.user_id]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Portal settings fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching portal settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
