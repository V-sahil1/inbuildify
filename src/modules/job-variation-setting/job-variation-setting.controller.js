import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createJobVariationSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const {
      allow_notes_in_variation = false,
      allow_cost_adjustment,
      show_notes_in_variation_by_default,
      drawing_changes_required = false,
      notify_signed_variation = false,
      notify_signed_variation_only_after_contract_prepared = false,
      allowed_move_job_to_construction_with_pending_variation = false,
      make_requested_by_and_delayed_days_mandatory = false,
      send_mail_when_variation_self_approved = false,
      contract_based_variation_header = false,
      contract_based_variation_header_title,
      pre_contract_header,
      post_contract_header,

      notify_signed_variation_user_ids = [],
      notify_signed_variation_group_ids = [],

      notify_after_contract_user_ids = [],
      notify_after_contract_group_ids = [],
    } = req.body;

    if (!companyId && !builderId) {
      return errorResponse(
        res,
        400,
        "Either company_id or builder_id must exist.",
      );
    }

    await client.query("BEGIN");

    const duplicate = await client.query(
      `
      SELECT 1 FROM job_variation_settings
      WHERE company_id = $1 AND builder_id = $2
      `,
      [companyId, builderId],
    );

    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Job variation settings already exist for this company and builder.",
      );
    }

    if (allow_notes_in_variation === false) {
      const costDefined = allow_cost_adjustment !== undefined;
      const showDefined = show_notes_in_variation_by_default !== undefined;

      if (costDefined || showDefined) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "You cannot define allow_cost_adjustment or show_notes_in_variation_by_default when allow_notes_in_variation = false.",
        );
      }
    }

    if (!contract_based_variation_header) {
      if (pre_contract_header || post_contract_header) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "pre_contract_header and post_contract_header are only allowed when contract_based_variation_header = true.",
        );
      }
    }

    if (contract_based_variation_header) {
      if (contract_based_variation_header_title) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "contract_based_variation_header_title is only allowed when contract_based_variation_header = false.",
        );
      }
    }

    if (!notify_signed_variation) {
      if (
        notify_signed_variation_user_ids.length > 0 ||
        notify_signed_variation_group_ids.length > 0
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Notify signed variation user/group IDs are only allowed when notify_signed_variation = true.",
        );
      }
    }

    if (!notify_signed_variation_only_after_contract_prepared) {
      if (
        notify_after_contract_user_ids.length > 0 ||
        notify_after_contract_group_ids.length > 0
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Notify after contract user/group IDs are only allowed when notify_signed_variation_only_after_contract_prepared = true.",
        );
      }
    }

    let allUserIds = [
      ...(notify_signed_variation_user_ids || []),
      ...(notify_after_contract_user_ids || []),
    ];

    // 1. Clean values: remove null, empty, trim whitespace
    allUserIds = allUserIds
      .filter((id) => id && typeof id === "string")
      .map((id) => id.trim());

    // 2. Remove duplicates
    allUserIds = [...new Set(allUserIds)];

    if (allUserIds.length > 0) {
      const userCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND is_deleted = false",
        [allUserIds],
      );

      if (userCheck.rows.length !== allUserIds.length) {
        return errorResponse(res, 400, "One or more user_ids are invalid");
      }
    }

    let allGroupIds = [
      ...(notify_signed_variation_group_ids || []),
      ...(notify_after_contract_group_ids || []),
    ];

    // 1. Remove null, empty, non-strings & trim
    allGroupIds = allGroupIds
      .filter((id) => id && typeof id === "string")
      .map((id) => id.trim());

    //  Remove duplicates
    allGroupIds = [...new Set(allGroupIds)];

    if (allGroupIds.length > 0) {
      const groupExistCheck = await client.query(
        `
    SELECT user_group_id 
    FROM user_group 
    WHERE user_group_id = ANY($1::uuid[])
      AND builder_id = $2
    `,
        [allGroupIds, builderId],
      );

      const existingIds = groupExistCheck.rows.map((r) => r.user_group_id);

      if (existingIds.length !== allGroupIds.length) {
        // find which IDs are invalid
        const invalidIds = allGroupIds.filter(
          (id) => !existingIds.includes(id),
        );

        return errorResponse(
          res,
          400,
          `Invalid user_group_ids: ${invalidIds.join(", ")}`,
        );
      }

      const groupActiveCheck = await client.query(
        `
    SELECT user_group_id 
    FROM user_group 
    WHERE user_group_id = ANY($1::uuid[])
      AND builder_id = $2
      AND is_active = true
    `,
        [allGroupIds, builderId],
      );

      const activeIds = groupActiveCheck.rows.map((r) => r.user_group_id);

      if (activeIds.length !== allGroupIds.length) {
        // find inactive IDs
        const inactiveIds = allGroupIds.filter((id) => !activeIds.includes(id));

        return errorResponse(
          res,
          400,
          `Inactive user_group_ids: ${inactiveIds.join(", ")}`,
        );
      }
    }

    const insertQuery = `
      INSERT INTO job_variation_settings (
        company_id,
        builder_id,
        allow_notes_in_variation,
        allow_cost_adjustment,
        show_notes_in_variation_by_default,
        drawing_changes_required,
        notify_signed_variation,
        notify_signed_variation_only_after_contract_prepared,
        allowed_move_job_to_construction_with_pending_variation,
        make_requested_by_and_delayed_days_mandatory,
        send_mail_when_variation_self_approved,
        contract_based_variation_header,
        contract_based_variation_header_title,
        pre_contract_header,
        post_contract_header,
        notify_signed_variation_user_ids,
        notify_signed_variation_group_ids,
        notify_after_contract_user_ids,
        notify_after_contract_group_ids,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      allow_notes_in_variation,
      allow_cost_adjustment || false,
      show_notes_in_variation_by_default || false,
      drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      !contract_based_variation_header
        ? contract_based_variation_header_title
        : null,
      contract_based_variation_header ? pre_contract_header : null,
      contract_based_variation_header ? post_contract_header : null,
      notify_signed_variation ? notify_signed_variation_user_ids : [],
      notify_signed_variation ? notify_signed_variation_group_ids : [],
      notify_signed_variation_only_after_contract_prepared
        ? notify_after_contract_user_ids
        : [],
      notify_signed_variation_only_after_contract_prepared
        ? notify_after_contract_group_ids
        : [],
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job variation settings created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating job variation settings:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateJobVariationSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const existing = await client.query(
      `
      SELECT * FROM job_variation_settings
      WHERE builder_id = $1
      `,
      [builderId],
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Settings not found for this builder");
    }

    const finalData = { ...existing.rows[0], ...req.body };

    let {
      allow_notes_in_variation,
      allow_cost_adjustment,
      show_notes_in_variation_by_default,
      drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      contract_based_variation_header_title,
      pre_contract_header,
      post_contract_header,
      notify_signed_variation_user_ids,
      notify_signed_variation_group_ids,
      notify_after_contract_user_ids,
      notify_after_contract_group_ids,
    } = finalData;

    await client.query("BEGIN");

    if (allow_notes_in_variation === false) {
      allow_cost_adjustment = false;
      show_notes_in_variation_by_default = false;

      if (
        req.body.allow_cost_adjustment === true ||
        req.body.show_notes_in_variation_by_default === true
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "allow_cost_adjustment and show_notes_in_variation_by_default can only be TRUE when allow_notes_in_variation = TRUE",
        );
      }
    }

    if (notify_signed_variation === false) {
      if (
        (req.body.notify_signed_variation_user_ids?.length || 0) > 0 ||
        (req.body.notify_signed_variation_group_ids?.length || 0) > 0
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "notify_signed_variation_user_ids and notify_signed_variation_group_ids cannot be defined when notify_signed_variation = FALSE",
        );
      }

      notify_signed_variation_user_ids = [];
      notify_signed_variation_group_ids = [];
    }

    if (notify_signed_variation_only_after_contract_prepared === false) {
      if (
        (req.body.notify_after_contract_user_ids?.length || 0) > 0 ||
        (req.body.notify_after_contract_group_ids?.length || 0) > 0
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "notify_after_contract_user_ids and notify_after_contract_group_ids cannot be defined when notify_signed_variation_only_after_contract_prepared = FALSE",
        );
      }

      notify_after_contract_user_ids = [];
      notify_after_contract_group_ids = [];
    }

    if (contract_based_variation_header === false) {
      pre_contract_header = null;
      post_contract_header = null;

      if (
        req.body.pre_contract_header != null ||
        req.body.post_contract_header != null
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "pre_contract_header & post_contract_header cannot be defined when contract_based_variation_header = FALSE",
        );
      }
    } else {
      if (req.body.contract_based_variation_header_title != null) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "contract_based_variation_header_title can only be defined when contract_based_variation_header = FALSE",
        );
      }
      contract_based_variation_header_title = null;
    }

    let allUserIds = [
      ...(notify_signed_variation_user_ids || []),
      ...(notify_after_contract_user_ids || []),
    ];

    allUserIds = [...new Set(allUserIds)];

    if (allUserIds.length > 0) {
      const userCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND is_deleted = false",
        [allUserIds],
      );

      const found = userCheck.rows.map((r) => r.users_id);
      const invalid = allUserIds.filter((id) => !found.includes(id));

      if (invalid.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid user_ids: ${invalid.join(", ")}`,
        );
      }
    }

    let allGroupIds = [
      ...(notify_signed_variation_group_ids || []),
      ...(notify_after_contract_group_ids || []),
    ];

    allGroupIds = [...new Set(allGroupIds)];

    if (allGroupIds.length > 0) {
      const groupExist = await client.query(
        `
        SELECT user_group_id
        FROM user_group
        WHERE user_group_id = ANY($1::uuid[])
        AND builder_id = $2
        `,
        [allGroupIds, builderId],
      );

      const exists = groupExist.rows.map((r) => r.user_group_id);
      const invalid = allGroupIds.filter((id) => !exists.includes(id));

      if (invalid.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid user_group_ids: ${invalid.join(", ")}`,
        );
      }

      const groupActive = await client.query(
        `
        SELECT user_group_id
        FROM user_group
        WHERE user_group_id = ANY($1::uuid[])
        AND builder_id = $2
        AND is_active = TRUE
        `,
        [allGroupIds, builderId],
      );

      const active = groupActive.rows.map((r) => r.user_group_id);
      const inactive = allGroupIds.filter((id) => !active.includes(id));

      if (inactive.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Inactive user_group_ids: ${inactive.join(", ")}`,
        );
      }
    }

    const updateQuery = `
      UPDATE job_variation_settings
      SET
        allow_notes_in_variation = $1,
        allow_cost_adjustment = $2,
        show_notes_in_variation_by_default = $3,
        drawing_changes_required = $4,
        notify_signed_variation = $5,
        notify_signed_variation_only_after_contract_prepared = $6,
        allowed_move_job_to_construction_with_pending_variation = $7,
        make_requested_by_and_delayed_days_mandatory = $8,
        send_mail_when_variation_self_approved = $9,
        contract_based_variation_header = $10,
        contract_based_variation_header_title = $11,
        pre_contract_header = $12,
        post_contract_header = $13,
        notify_signed_variation_user_ids = $14,
        notify_signed_variation_group_ids = $15,
        notify_after_contract_user_ids = $16,
        notify_after_contract_group_ids = $17,
        updated_by = $18,
        updated_at = NOW()
      WHERE builder_id = $19
      RETURNING  allow_notes_in_variation,
      allow_cost_adjustment,
      show_notes_in_variation_by_default,
      drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      contract_based_variation_header_title,
      pre_contract_header,
      post_contract_header,
      notify_signed_variation_user_ids,
      notify_signed_variation_group_ids,
      notify_after_contract_user_ids,
      notify_after_contract_group_ids;
    `;

    const values = [
      allow_notes_in_variation,
      allow_cost_adjustment,
      show_notes_in_variation_by_default,
      drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      contract_based_variation_header_title,
      pre_contract_header,
      post_contract_header,
      notify_signed_variation_user_ids,
      notify_signed_variation_group_ids,
      notify_after_contract_user_ids,
      notify_after_contract_group_ids,
      userId,
      builderId,
    ];

    const updated = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Job variation settings updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating job variation settings:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getUserJobVariationSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT  allow_notes_in_variation,
      allow_cost_adjustment,
      show_notes_in_variation_by_default,
      drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      contract_based_variation_header_title,
      pre_contract_header,
      post_contract_header,
      notify_signed_variation_user_ids,
      notify_signed_variation_group_ids,
      notify_after_contract_user_ids,
      notify_after_contract_group_ids
      FROM job_variation_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO job_variation_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        RETURNING  allow_notes_in_variation,
      allow_cost_adjustment,
      show_notes_in_variation_by_default,
      drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      contract_based_variation_header_title,
      pre_contract_header,
      post_contract_header,
      notify_signed_variation_user_ids,
      notify_signed_variation_group_ids,
      notify_after_contract_user_ids,
      notify_after_contract_group_ids;
        `,
        [company_id, builder_id, user_id],
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job variation settings fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching job variation settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}
