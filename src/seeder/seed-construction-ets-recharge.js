/**
 * Seed default construction_ets_recharge for a new builder
 */
async function seedConstructionEtsRecharge({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO construction_ets_recharge (
      company_id, builder_id,
      enable_ets_supplier, enable_recharge_supplier,
      signature_section,
      created_by, updated_by
    ) VALUES ($1, $2, false, true, true, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedConstructionEtsRecharge };
