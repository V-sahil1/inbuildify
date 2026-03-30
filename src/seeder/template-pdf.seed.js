
import getPool from "../config/database.js";
import pdfTemplates from "../templates/pdf-template.json" with { type: "json" };
import { keysToCamelCase, keysToSnakeCase } from "../utils/common.js";

/**
 * Convert camelCase key to Title Case
 * invoiceFormat -> Invoice Format
 */
function keyToTitle(key) {
  return key
    // convert snake_case to spaces
    .replace(/[_-]/g, " ")
    // add spaces before CamelCase capitals
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // normalize spacing
    .replace(/\s+/g, " ")
    // trim
    .trim()
    // capitalize first letter of each word
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function seedInitialPdfTemplates({
  company_id = null,
  builder_id = null,
  created_by,
  client: externalClient = null,
}) {
  if (!company_id && !builder_id) {
    throw new Error("Either company_id or builder_id is required");
  }

  const useExternalClient = !!externalClient;
  const pool = useExternalClient ? null : getPool();
  const client = externalClient || (await pool.connect());

  try {
    if (!useExternalClient) {
      await client.query("BEGIN");
    }

    for (const [key, templateJson] of Object.entries(pdfTemplates)) {
      const name = keyToTitle(key);

      const existing = await client.query(
        `SELECT template_pdf_id FROM template_pdf
         WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL) AND name = $3
         LIMIT 1`,
        [company_id, builder_id, name],
      );

      if (existing.rowCount === 0) {
        await client.query(
          `
          INSERT INTO template_pdf (
            template_pdf_id,
            company_id,
            builder_id,
            name,
            template_json,
            created_by,
            updated_by
          )
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $5)
          `,
          [
            company_id,
            builder_id,
            name,
            keysToSnakeCase(templateJson),
            created_by,
          ],
        );
      }
    }

    if (!useExternalClient) {
      await client.query("COMMIT");
    }
  } catch (err) {
    if (!useExternalClient) {
      await client.query("ROLLBACK");
    }
    throw err;
  } finally {
    if (!useExternalClient) {
      client.release();
    }
  }
}

export default {
  seedInitialPdfTemplates,
};
