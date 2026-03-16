/**
 * Seed default password_policy for a new builder
 */
async function seedPasswordPolicy({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO password_policy (
      company_id, builder_id,
      expires_in_days, invalid_attempt_limit,
      alert_before_expiry_days, password_history_count,
      enforce_strong_password, is_active,
      created_by, updated_by
    ) VALUES ($1, $2, 90, 5, 7, 5, true, true, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedPasswordPolicy };
