/**
 * Seed default quotation_settings for a new builder
 */
export async function seedQuotationSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO quotation_settings (
      company_id, builder_id,
      allow_save_as_new_version, mandatory_contact_details,
      mandatory_dwelling_type, mandatory_sketch_number,
      mandatory_land_title, enable_dwelling_size,
      enable_builder_cost, allow_notes, allow_cost_adjustment,
      show_notes_by_default, allow_multiple_packages,
      include_additional_items_in_price_adjusted_list,
      auto_approve_on_sales_won,
      show_default_pricelist_in_additional_items,
      hide_price_to_customer, enable_estimated_price_range,
      quotation_validity_days, extend_validity_from_updated_date,
      created_by, updated_by
    ) VALUES (
      $1, $2,
      false, false, false, false, false, false, false,
      true, true, true, false, false, false, true, false, false,
      30, 0, $3, $3
    )
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedQuotationSettings };
