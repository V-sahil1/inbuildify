/**
 * Seed default job_color_settings for a new builder
 */
async function seedJobColorSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO job_color_settings (
      company_id, builder_id,
      hide_color_item_images, hide_color_item_price,
      exit_color_code, page_orientation_portrait,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, true, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedJobColorSettings };
