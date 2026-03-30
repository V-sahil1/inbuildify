/**
 * Seed default document_folder_mapping for a new builder
 */
export async function seedDocumentFolderMapping({ company_id, builder_id, created_by, client }) {
  // document_folder_mapping has no unique constraint on (company_id, builder_id)
  const existing = await client.query(
    `SELECT document_folder_mapping_id FROM document_folder_mapping
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO document_folder_mapping (
        document_folder_mapping_id,
        company_id, 
        builder_id,
        signed_quotation,
        signed_color,
        signed_variation,
        signed_maintenance,
        signed_contract_document,
        compliance_certificate,
        purchase_order,
        job_documents,
        select_all_files_from_folder,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedDocumentFolderMapping };
