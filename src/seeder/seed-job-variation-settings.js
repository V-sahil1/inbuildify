/**
 * Seed default job_variation_settings for a new builder
 */
export async function seedJobVariationSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT job_variation_settings_id FROM job_variation_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO job_variation_settings (
        job_variation_settings_id,
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
        created_by, 
        updated_by
      ) VALUES (
        gen_random_uuid(), $1, $2, 
        FALSE, FALSE, FALSE, FALSE, FALSE, 
        FALSE, FALSE, FALSE, FALSE, FALSE, 
        NULL, NULL, NULL, '{}', '{}', '{}', $3, $3
      )`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedJobVariationSettings };
