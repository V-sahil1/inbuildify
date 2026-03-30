/**
 * Seed default job_settings for a new builder
 */
export async function seedJobSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT job_settings_id FROM job_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO job_settings (
        job_settings_id,
        company_id, 
        builder_id,
        auto_move_to_maintenance, 
        auto_mark_completed,
        auto_archive_after_completion,
        auto_archive_after_days,
        milestone_status_check_days,
        report_custom_days,
        report_status_filter, 
        report_include_date,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, FALSE, NULL, NULL, NULL, 'all', TRUE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedJobSettings };
