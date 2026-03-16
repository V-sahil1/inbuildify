/**
 * Seed default house_land_package_settings for a new builder
 */
async function seedHouseLandPackageSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO house_land_package_settings (
      company_id, builder_id,
      include_facade_cost_in_total,
      created_by, updated_by
    ) VALUES ($1, $2, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedHouseLandPackageSettings };
