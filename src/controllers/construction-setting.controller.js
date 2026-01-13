const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  try {
    if (!builderId) {
      return errorResponse(res, 400, "Builder ID not found in user context.");
    }

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    await client.query("BEGIN");

    const existingSettings = await client.query(
      `
        SELECT construction_setting_id 
        FROM construction_settings 
        WHERE company_id = $1 AND builder_id = $2;
      `,
      [companyId, builderId]
    );

    if (existingSettings.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Construction settings already exist for this company and builder."
      );
    }

    const {
      suppliers_tradies_madatory_to_complete_checklist,
      allow_checklist_even_supplier_tradies_not_responded,
      show_warning_when_supplier_trade_booked_same_day_for_checklist,
      sending_email_private_inspector_mandatory,
      make_inspection_chacklist_mandatory,
      include_weekend_date,
      include_holiday_date,
      include_onhold_date,
      allow_stage_date_change,
      default_lead_time_for_supplier_trade,
      no_of_reminder_days,
      allow_move_next_stage_even_checklist_not_completed,
      apply_changes_all_existing_jobs,
      rebook_confrimed_bookings_on_date_changes,
      send_email_when_stage_completed,
      move_jobs_from_ready_for_construction_to_under_construction,
      recalculate_stage_date_construction_days_when_deleys_captured,
      enable_forcast_date,
      number_of_days_site_start_from_title_date,
      label_for_permit_received_date,
      site_supervisor_roles = [],
      stage_completion_date,
      admin_coordinator_roles = [],
    } = req.body;

    if (
      suppliers_tradies_madatory_to_complete_checklist === false ||
      suppliers_tradies_madatory_to_complete_checklist === undefined
    ) {
      const costDefined =
        allow_checklist_even_supplier_tradies_not_responded !== undefined;

      if (costDefined) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "You cannot define allow_checklist_even_supplier_tradies_not_responded when suppliers_tradies_madatory_to_complete_checklist is false ."
        );
      }
    }

    let finalReminderDays = null;

    if (default_lead_time_for_supplier_trade === false) {
      if (no_of_reminder_days !== undefined && no_of_reminder_days !== null) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Reminder days cannot be defined when default lead time is disabled."
        );
      }
      finalReminderDays = null;
    } else {
      if (no_of_reminder_days === undefined || no_of_reminder_days === null) {
        finalReminderDays = 7;
      } else {
        finalReminderDays = no_of_reminder_days;
      }
    }

    if (admin_coordinator_roles.length > 0) {
      const adminCheck = await client.query(
        `
          SELECT role_id 
          FROM role
          WHERE role_id = ANY($1) AND builder_id = $2;
        `,
        [admin_coordinator_roles, builderId]
      );

      if (adminCheck.rowCount !== admin_coordinator_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid admin coordinator roles");
      }
    }

    if (admin_coordinator_roles.length > 0) {
      const adminCheck = await client.query(
        `
          SELECT role_id 
          FROM role
          WHERE role_id = ANY($1) AND builder_id = $2 AND is_active = true;
        `,
        [admin_coordinator_roles, builderId]
      );

      if (adminCheck.rowCount !== admin_coordinator_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive admin coordinator roles");
      }
    }

    if (site_supervisor_roles.length > 0) {
      const supervisorCheck = await client.query(
        `
          SELECT role_id 
          FROM role
          WHERE role_id = ANY($1) AND builder_id = $2;
        `,
        [site_supervisor_roles, builderId]
      );

      if (supervisorCheck.rowCount !== site_supervisor_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid site supervisor roles");
      }
    }

    if (site_supervisor_roles.length > 0) {
      const supervisorCheck = await client.query(
        `
          SELECT role_id 
        FROM role
          WHERE role_id = ANY($1) AND builder_id = $2 AND is_active = true;
        `,
        [site_supervisor_roles, builderId]
      );

      if (supervisorCheck.rowCount !== site_supervisor_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive site supervisor roles");
      }
    }

    const insertQuery = `
      INSERT INTO construction_settings (
        company_id,
        builder_id,
        suppliers_tradies_madatory_to_complete_checklist,
        allow_checklist_even_supplier_tradies_not_responded,
        show_warning_when_supplier_trade_booked_same_day_for_checklist,
        sending_email_private_inspector_mandatory,
        make_inspection_chacklist_mandatory,
        include_weekend_date,
        include_holiday_date,
        include_onhold_date,
        allow_stage_date_change,
        default_lead_time_for_supplier_trade,
        no_of_reminder_days,
        allow_move_next_stage_even_checklist_not_completed,
        apply_changes_all_existing_jobs,
        rebook_confrimed_bookings_on_date_changes,
        send_email_when_stage_completed,
        move_jobs_from_ready_for_construction_to_under_construction,
        recalculate_stage_date_construction_days_when_deleys_captured,
        enable_forcast_date,
        number_of_days_site_start_from_title_date,
        label_for_permit_received_date,
        site_supervisor_roles,
        stage_completion_date,
        admin_coordinator_roles,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26,$27
      )
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,

      suppliers_tradies_madatory_to_complete_checklist || false,
      allow_checklist_even_supplier_tradies_not_responded || false,
      show_warning_when_supplier_trade_booked_same_day_for_checklist || false,
      sending_email_private_inspector_mandatory || false,
      make_inspection_chacklist_mandatory || false,
      include_weekend_date || false,
      include_holiday_date || false,
      include_onhold_date || false,
      allow_stage_date_change || false,
      default_lead_time_for_supplier_trade || false,
      //   no_of_reminder_days,
      finalReminderDays,
      allow_move_next_stage_even_checklist_not_completed || false,
      apply_changes_all_existing_jobs || false,
      rebook_confrimed_bookings_on_date_changes || false,
      send_email_when_stage_completed || false,
      move_jobs_from_ready_for_construction_to_under_construction || false,
      recalculate_stage_date_construction_days_when_deleys_captured || false,
      enable_forcast_date || false,

      number_of_days_site_start_from_title_date || 90,
      label_for_permit_received_date || null,
      site_supervisor_roles,
      stage_completion_date || "claim",
      admin_coordinator_roles,

      userId,
      userId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction settings created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating construction settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getConstructionSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  try {
    if (!builderId) {
      return errorResponse(res, 400, "Builder ID not found in user context.");
    }

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    let result = await client.query(
      `
        SELECT *
        FROM construction_settings
        WHERE builder_id = $1 AND company_id = $2
        LIMIT 1;
      `,
      [builderId, companyId]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO construction_settings (
          builder_id, 
          company_id, 
          created_by, 
          updated_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [builderId, companyId, userId, userId]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      result.rowCount === 0
        ? "Construction settings created and retrieved successfully."
        : "Construction settings retrieved successfully."
    );
  } catch (err) {
    console.error("Error fetching construction settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateConstructionSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  try {
    if (!builderId)
      return errorResponse(res, 400, "Builder ID not found in user context.");
    if (!companyId) return errorResponse(res, 400, "Company ID not found.");

    await client.query("BEGIN");

    const existingSettingsResult = await client.query(
      `SELECT * FROM construction_settings WHERE company_id = $1 AND builder_id = $2 LIMIT 1;`,
      [companyId, builderId]
    );

    if (existingSettingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "No construction settings found to update for this company and builder."
      );
    }

    const existingSettings = existingSettingsResult.rows[0];

    const {
      suppliers_tradies_madatory_to_complete_checklist,
      allow_checklist_even_supplier_tradies_not_responded,
      show_warning_when_supplier_trade_booked_same_day_for_checklist,
      sending_email_private_inspector_mandatory,
      make_inspection_chacklist_mandatory,
      include_weekend_date,
      include_holiday_date,
      include_onhold_date,
      allow_stage_date_change,
      default_lead_time_for_supplier_trade,
      no_of_reminder_days,
      allow_move_next_stage_even_checklist_not_completed,
      apply_changes_all_existing_jobs,
      rebook_confrimed_bookings_on_date_changes,
      send_email_when_stage_completed,
      move_jobs_from_ready_for_construction_to_under_construction,
      recalculate_stage_date_construction_days_when_deleys_captured,
      enable_forcast_date,
      number_of_days_site_start_from_title_date,
      label_for_permit_received_date,
      site_supervisor_roles = [],
      stage_completion_date,
      admin_coordinator_roles = [],
    } = req.body;

    const fields = [];
    const values = [];
    let i = 1;

    const addField = (fieldName, value) => {
      fields.push(`${fieldName} = $${i++}`);
      values.push(value);
    };

    let finalSuppliersChecklist =
      existingSettings.suppliers_tradies_madatory_to_complete_checklist;
    let finalAllowChecklist =
      existingSettings.allow_checklist_even_supplier_tradies_not_responded;

    if (suppliers_tradies_madatory_to_complete_checklist !== undefined) {
      finalSuppliersChecklist =
        suppliers_tradies_madatory_to_complete_checklist;

      if (suppliers_tradies_madatory_to_complete_checklist === false) {
        if (allow_checklist_even_supplier_tradies_not_responded === true) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "Cannot define allow_checklist_even_supplier_tradies_not_responded when checklist mandatory is false."
          );
        }
        finalAllowChecklist = false;
      } else {
        finalAllowChecklist =
          allow_checklist_even_supplier_tradies_not_responded !== undefined
            ? allow_checklist_even_supplier_tradies_not_responded
            : existingSettings.allow_checklist_even_supplier_tradies_not_responded;
      }

      addField(
        "suppliers_tradies_madatory_to_complete_checklist",
        finalSuppliersChecklist
      );
      addField(
        "allow_checklist_even_supplier_tradies_not_responded",
        finalAllowChecklist
      );
    } else if (
      allow_checklist_even_supplier_tradies_not_responded !== undefined
    ) {
      if (
        existingSettings.suppliers_tradies_madatory_to_complete_checklist ===
        false
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Cannot define allow_checklist_even_supplier_tradies_not_responded when checklist mandatory is false."
        );
      }
      addField(
        "allow_checklist_even_supplier_tradies_not_responded",
        allow_checklist_even_supplier_tradies_not_responded
      );
    }

    let finalReminderDays = existingSettings.no_of_reminder_days;
    let finalLeadTime = existingSettings.default_lead_time_for_supplier_trade;

    if (default_lead_time_for_supplier_trade !== undefined) {
      finalLeadTime = default_lead_time_for_supplier_trade;

      if (default_lead_time_for_supplier_trade === false) {
        if (no_of_reminder_days !== undefined && no_of_reminder_days !== null) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "Reminder days cannot be defined when default lead time is disabled."
          );
        }
        finalReminderDays = null;
      } else {
        finalReminderDays =
          no_of_reminder_days !== undefined && no_of_reminder_days !== null
            ? no_of_reminder_days
            : 7;
      }

      addField("default_lead_time_for_supplier_trade", finalLeadTime);
      addField("no_of_reminder_days", finalReminderDays);
    } else if (no_of_reminder_days !== undefined) {
      if (existingSettings.default_lead_time_for_supplier_trade === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Reminder days cannot be defined when default lead time is disabled."
        );
      }
      addField("no_of_reminder_days", no_of_reminder_days);
    }

    const otherFields = [
      "show_warning_when_supplier_trade_booked_same_day_for_checklist",
      "sending_email_private_inspector_mandatory",
      "make_inspection_chacklist_mandatory",
      "include_weekend_date",
      "include_holiday_date",
      "include_onhold_date",
      "allow_stage_date_change",
      "allow_move_next_stage_even_checklist_not_completed",
      "apply_changes_all_existing_jobs",
      "rebook_confrimed_bookings_on_date_changes",
      "send_email_when_stage_completed",
      "move_jobs_from_ready_for_construction_to_under_construction",
      "recalculate_stage_date_construction_days_when_deleys_captured",
      "enable_forcast_date",
      "number_of_days_site_start_from_title_date",
      "label_for_permit_received_date",
      "stage_completion_date",
    ];

    otherFields.forEach((field) => {
      if (req.body[field] !== undefined) addField(field, req.body[field]);
    });

    if (admin_coordinator_roles.length > 0) {
      const adminCheck = await client.query(
        `SELECT role_id FROM role WHERE role_id = ANY($1)`,
        [admin_coordinator_roles]
      );
      if (adminCheck.rowCount !== admin_coordinator_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid admin coordinator roles");
      }

      addField("admin_coordinator_roles", admin_coordinator_roles);
    }

    if (site_supervisor_roles.length > 0) {
      const supervisorCheck = await client.query(
        `SELECT role_id FROM role WHERE role_id = ANY($1)`,
        [site_supervisor_roles]
      );
      if (supervisorCheck.rowCount !== site_supervisor_roles.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid site supervisor roles");
      }

      addField("site_supervisor_roles", site_supervisor_roles);
    }

    addField("updated_by", userId);
    addField("updated_at", "NOW()");

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    const updateQuery = `
      UPDATE construction_settings
      SET ${fields.join(", ")}
      WHERE construction_setting_id = $${i}
      RETURNING *;
    `;

    values.push(existingSettings.construction_setting_id);

    const updateResult = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Construction settings updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating construction settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
