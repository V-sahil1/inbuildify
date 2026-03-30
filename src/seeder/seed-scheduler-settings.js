/**
 * Seed default scheduler_settings for a new builder
 */
export async function seedSchedulerSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT scheduler_settings_id FROM scheduler_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );  

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO scheduler_settings (
        scheduler_settings_id,
        company_id, 
        builder_id,
        receiver_of_replies,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, '{}', $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedSchedulerSettings };
