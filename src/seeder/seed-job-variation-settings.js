/**
 * Seed default job_variation_settings for a new builder
 */
export async function seedJobVariationSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO job_variation_settings (
      company_id, builder_id,
      allow_notes_in_variation, allow_cost_adjustment,
      show_notes_in_variation_by_default, drawing_changes_required,
      notify_signed_variation,
      notify_signed_variation_only_after_contract_prepared,
      allowed_move_job_to_construction_with_pending_variation,
      make_requested_by_and_delayed_days_mandatory,
      send_mail_when_variation_self_approved,
      contract_based_variation_header,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, false, false, false, false, false, false, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedJobVariationSettings };
