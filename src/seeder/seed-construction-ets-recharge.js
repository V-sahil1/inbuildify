/**
 * Seed default construction_ets_recharge for a new builder
 */
export async function seedConstructionEtsRecharge({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT construction_ets_recharge_id FROM construction_ets_recharge
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO construction_ets_recharge (
        construction_ets_recharge_id,
        company_id, 
        builder_id,
        enable_ets_supplier, 
        enable_recharge_supplier,
        signature_section,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, TRUE, TRUE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedConstructionEtsRecharge };
