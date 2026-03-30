/**
 * Seed default quotation_settings for a new builder
 */
export async function seedQuotationSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT quotation_settings_id FROM quotation_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO quotation_settings (
        quotation_settings_id,
        company_id, 
        builder_id,
        allow_save_as_new_version,
        mandatory_contact_details,
        mandatory_dwelling_type,
        mandatory_sketch_number,
        mandatory_land_title,
        enable_dwelling_size,
        enable_builder_cost,
        allow_notes,
        allow_cost_adjustment,
        show_notes_by_default,
        allow_multiple_packages,
        include_additional_items_in_price_adjusted_list,
        auto_approve_on_sales_won,
        show_default_pricelist_in_additional_items,
        hide_price_to_customer,
        enable_estimated_price_range,
        quotation_validity_days,
        extend_validity_from_updated_date,
        created_by,
        updated_by
      ) VALUES (
        gen_random_uuid(), $1, $2, 
        FALSE, FALSE, FALSE, FALSE, FALSE, 
        FALSE, FALSE, TRUE, TRUE, TRUE, 
        FALSE, FALSE, FALSE, TRUE, FALSE, 
        FALSE, 30, 0, $3, $3
      )`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedQuotationSettings };
