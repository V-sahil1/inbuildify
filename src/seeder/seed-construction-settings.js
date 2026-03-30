/**
 * Seed default construction_settings for a new builder
 */
export async function seedConstructionSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT construction_setting_id FROM construction_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO construction_settings (
        construction_setting_id,
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
      ) VALUES (
        gen_random_uuid(), $1, $2, 
        FALSE, FALSE, FALSE, FALSE, FALSE, 
        FALSE, FALSE, FALSE, FALSE, FALSE, 
        7, FALSE, FALSE, FALSE, FALSE, FALSE, 
        FALSE, FALSE, 90, NULL, '{}', 'claim', '{}', $3, $3
      )`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedConstructionSettings };
