/**
 * Seed default construction_ohs_settings for a new builder
 */
async function seedConstructionOhsSettings({ company_id, builder_id, created_by, client }) {
  // Check if a row already exists for this builder
  const existing = await client.query(
    `SELECT construction_ohs_settings_id FROM construction_ohs_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO construction_ohs_settings (
        company_id, builder_id,
        signature_required, minimum_audits,
        created_by, updated_by
      ) VALUES ($1, $2, false, 0, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedConstructionOhsSettings };
