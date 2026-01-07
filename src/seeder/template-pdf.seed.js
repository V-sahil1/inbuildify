const getPool = require("../config/database");
const pdfTemplates = require("../templates/pdf-template.json");
const { keysToCamelCase, keysToSnakeCase } = require("../utils/common");

/**
 * Convert camelCase key to Title Case
 * invoiceFormat -> Invoice Format
 */
function keyToTitle(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
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
}) {
  if (!company_id && !builder_id) {
    throw new Error("Either company_id or builder_id is required");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  seedInitialPdfTemplates,
};
