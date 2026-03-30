/**
 * Seed default job_color_settings for a new builder
 */
export async function seedJobColorSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT job_color_settings_id FROM job_color_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO job_color_settings (
        job_color_settings_id,
        company_id, 
        builder_id,
        hide_color_item_images, 
        hide_color_item_price,
        exit_color_code,
        page_orientation_portrait,
        header_text,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, FALSE, TRUE, NULL, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedJobColorSettings };
