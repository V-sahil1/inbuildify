/**
 * Seed default construction_settings for a new builder
 */
export async function seedConstructionSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO construction_settings (
      company_id, builder_id,
      suppliers_tradies_madatory_to_complete_checklist,
      allow_checklist_even_supplier_tradies_not_responded,
      show_warning_when_supplier_trade_booked_same_day_for_checklist,
      sending_email_private_inspector_mandatory,
      make_inspection_chacklist_mandatory,
      include_weekend_date, include_holiday_date,
      include_onhold_date, allow_stage_date_change,
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
      stage_completion_date,
      created_by, updated_by
    ) VALUES (
      $1, $2,
      false, false, false, false, false,
      false, false, false, false, false,
      7, false, false, false, false, false, false, false,
      90, 'claim', $3, $3
    )
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedConstructionSettings };
