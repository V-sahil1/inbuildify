/**
 * Seed default document_file_naming_format for a new builder
 */
export async function seedDocumentFileNamingFormat({ company_id, builder_id, created_by, client }) {
  // document_file_naming_format has no unique constraint on (company_id, builder_id)
  const existing = await client.query(
    `SELECT document_file_naming_format_id FROM document_file_naming_format
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO document_file_naming_format (
        document_file_naming_format_id,
        company_id, 
        builder_id,
        naming_format,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, NULL, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedDocumentFileNamingFormat };
