/**
 * Seed default template_email_signature for a new builder
 */
export async function seedTemplateEmailSignature({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT template_email_signature_id FROM template_email_signature
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO template_email_signature (
        template_email_signature_id,
        company_id, 
        builder_id,
        include_email_signature,
        signature_content,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, NULL, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedTemplateEmailSignature };
