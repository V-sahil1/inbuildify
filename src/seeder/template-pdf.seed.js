import getPool from "../config/database";
import pdfTemplates from "../templates/pdf-template.json";
import { keysToCamelCase, keysToSnakeCase } from "../utils/common";

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

/**
 * Seed initial PDF templates
 * - Creates one row per format
 * - Safe to run multiple times
 */
async function seedInitialPdfTemplates({
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

      await client.query(
        `
        INSERT INTO template_pdf (
          company_id,
          builder_id,
          name,
          template_json,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $5)
        ON CONFLICT (company_id, builder_id, name)
        DO NOTHING
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
