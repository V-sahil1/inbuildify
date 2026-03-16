/**
 * Seed default scheduler_settings for a new builder
 */
async function seedSchedulerSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO scheduler_settings (
      company_id, builder_id,
      created_by, updated_by
    ) VALUES ($1, $2, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedSchedulerSettings };
