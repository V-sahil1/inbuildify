/**
 * Seed default house_land_package_settings for a new builder
 */
export async function seedHouseLandPackageSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT house_land_package_settings_id FROM house_land_package_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO house_land_package_settings (
        house_land_package_settings_id,
        company_id, 
        builder_id,
        include_facade_cost_in_total,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedHouseLandPackageSettings };
