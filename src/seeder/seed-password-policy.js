/**
 * Seed default password_policy for a new builder
 */
export async function seedPasswordPolicy({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT password_policy_id FROM password_policy
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO password_policy (
        password_policy_id,
        company_id, 
        builder_id,
        expires_in_days, 
        invalid_attempt_limit,
        alert_before_expiry_days, 
        password_history_count,
        enforce_strong_password, 
        is_active,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, 90, 5, 7, 5, TRUE, TRUE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedPasswordPolicy };
