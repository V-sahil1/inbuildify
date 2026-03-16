import getPool from "../../config/database";
import { seedInitialPdfTemplates } from "../../seeder/template-pdf.seed";
import { deleteFromS3 } from "../../utils/s3Upload";
import { getFormatValidationSchema } from "./template-pdf.validation";

function mergeTemplateImages(base, payload) {
  const result = { ...base };

  if (payload.logo_image) {
    result.logo_image = payload.logo_image;
  }

  if (payload.watermark_image) {
    result.watermark_image = payload.watermark_image;
  }

  return result;
}

function resolveScope(user) {
  return {
    company_id: user.company_id || null,
    builder_id: user.builder_id || null,
  };
}

async function createTemplatePdf(user, payload) {
  const pool = getPool();

  const templateJson = mergeTemplateImages({}, payload);

  const result = await pool.query(
    `
    INSERT INTO template_pdf (
      company_id,
      builder_id,
      name,
      template_json,
      created_by,
      updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$5)
    RETURNING *
    `,
    [
      user.company_id,
      user.builder_id,
      payload.name,
      templateJson,
      user.users_id,
    ],
  );

  return result.rows[0];
}

const formatTypeMap = {
  invoice_format: "Invoice Format",
  receipt_format: "Receipt Format",
  variation_format: "Variation Format",
  color_format: "Color Format",
  maintenance_format: "Maintenance Format",
};

function normalizeFormatType(type) {
  if (!type) {
    return null;
  }

  const cleaned = String(type).trim();

  // Option 1: user sends "invoice_format"
  if (formatTypeMap[cleaned]) {
    return cleaned;
  }

  // Option 2: user sends "Invoice Format"
  const found = Object.entries(formatTypeMap).find(
    ([key, value]) => value.toLowerCase() === cleaned.toLowerCase(),
  );

  if (found) {
    return found[0]; // return invoice_format
  }

  return null;
}

async function updateTemplatePdf(user, templatePdfId, formatType, payload) {
  const pool = getPool();
  const existing = await getTemplatePdfById(user, templatePdfId);
  if (!existing) {
    throw new Error("Template not found");
  }

  const expectedName = formatTypeMap[formatType];
  if (!expectedName) {
    throw new Error("Invalid format_type");
  }

  if (existing.name !== expectedName) {
    throw new Error(`Template is not of type ${formatType}`);
  }

  const existingJson = existing.template_json || {};
  const updatedJson = deepMergeFormatSection(existingJson, payload, formatType);

  // Delete old images if replaced
  if (payload.logo_image && existingJson?.logo_settings?.logo_image) {
    deleteFromS3(existingJson.logo_settings.logo_image);
  }
  if (payload.watermark_image && existingJson?.logo_settings?.watermark_image) {
    deleteFromS3(existingJson.logo_settings.watermark_image);
  }

  const result = await pool.query(
    `
    UPDATE template_pdf
    SET 
      name = COALESCE($1, name),
      template_json = $2,
      updated_by = $3,
      updated_at = NOW()
    WHERE template_pdf_id = $4
    RETURNING *
    `,
    [payload.name ?? null, updatedJson, user.users_id, templatePdfId],
  );

  return result.rows[0];
}

async function getTemplatePdfById(user, templatePdfId) {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const result = await pool.query(
    `
    SELECT *
    FROM template_pdf
    WHERE template_pdf_id = $1
      AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      )
    `,
    [templatePdfId, company_id, builder_id],
  );

  return result.rows[0] || null;
}

async function getTemplatePdfList(user) {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  let result = await pool.query(
    `
    SELECT *
    FROM template_pdf
    WHERE
      (company_id = $1 AND $1 IS NOT NULL)
      OR (builder_id = $2 AND $2 IS NOT NULL)
    ORDER BY created_at DESC
    `,
    [company_id, builder_id],
  );

  if (result.rowCount === 0) {
    await seedInitialPdfTemplates({
      company_id,
      builder_id,
      created_by: user.users_id,
    });

    result = await pool.query(
      `
      SELECT *
      FROM template_pdf
      WHERE
        (company_id = $1 AND $1 IS NOT NULL)
        OR (builder_id = $2 AND $2 IS NOT NULL)
      ORDER BY created_at DESC
      `,
      [company_id, builder_id],
    );
  }

  return result.rows;
}

async function deleteTemplatePdf(user, templatePdfId) {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const result = await pool.query(
    `
    DELETE FROM template_pdf
    WHERE template_pdf_id = $1
      AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      )
    `,
    [templatePdfId, company_id, builder_id],
  );

  if (result.rowCount === 0) {
    throw new Error("Template not found or access denied");
  }
}

/* -------------------------------------------
   PATCH-style merge for direct field updates
   ------------------------------------------- */
function getAllowedKeysFromSchema(schema) {
  const desc = schema.describe();
  return Object.keys(desc.keys || {});
}

function deepPatchMerge(target, source) {
  const output = structuredClone(target);

  for (const [key, value] of Object.entries(source)) {
    // If source value is object → deep merge
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = deepPatchMerge(
        output[key] || {}, // existing sub-object
        value,
      );
    } else {
      // primitive or null → overwrite
      output[key] = value;
    }
  }

  return output;
}

function deepMergeFormatSection(existing, payload, formatType) {
  const schema = getFormatValidationSchema(formatType);
  const allowedKeys = getAllowedKeysFromSchema(schema);

  const updated = structuredClone(existing);

  for (const [key, value] of Object.entries(payload)) {
    if (!allowedKeys.includes(key)) {
      continue;
    } // whitelist check

    if (value && typeof value === "object" && !Array.isArray(value)) {
      updated[key] = deepPatchMerge(updated[key] || {}, value);
    } else {
      updated[key] = value;
    }
  }

  updated.logo_settings = updated.logo_settings || {};

  if (payload.logo_image) {
    updated.logo_settings.logo_image = payload.logo_image;
  }
  if (payload.watermark_image) {
    updated.logo_settings.watermark_image = payload.watermark_image;
  }

  return updated;
}

export default {
  createTemplatePdf,
  updateTemplatePdf,
  getTemplatePdfById,
  getTemplatePdfList,
  deleteTemplatePdf,
  normalizeFormatType,
};
