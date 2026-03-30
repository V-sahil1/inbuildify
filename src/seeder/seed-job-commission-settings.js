/**
 * Seed default job_commission_settings for a new builder
 */
export async function seedJobCommissionSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT job_commission_settings_id FROM job_commission_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO job_commission_settings (
        job_commission_settings_id,
        company_id, 
        builder_id,
        define_outgoing_commission, 
        define_incoming_commission,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedJobCommissionSettings };
