/**
 * Seed default template_email_signature for a new builder
 */
async function seedTemplateEmailSignature({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO template_email_signature (
      company_id, builder_id,
      include_email_signature,
      created_by, updated_by
    ) VALUES ($1, $2, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedTemplateEmailSignature };
