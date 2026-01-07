const getPool = require("../config/database");
const { seedInitialPdfTemplates } = require("../seeder/template-pdf.seed");

function resolveScope(user) {
  return {
    company_id: user.company_id || null,
    builder_id: user.builder_id || null,
  };
}

async function createTemplatePdf(user, payload, images) {
  const pool = getPool();
  const templateJson = mergeTemplateImages(payload.template_json, images);

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
    ]
  );

  return result.rows[0];
}

async function updateTemplatePdf(user, templatePdfId, payload, images) {
  console.log("🚀 ~ updateTemplatePdf ~ images:", images)
  const pool = getPool();
  const existing = await getTemplatePdfById(user, templatePdfId);
  if (!existing) throw new Error("Template not found");

  const updatedJson = payload.template_json
    ? mergeTemplateImages(payload.template_json, images)
    : mergeTemplateImages(existing.template_json, images);

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
    [payload.name, updatedJson, user.users_id, templatePdfId]
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
    [templatePdfId, company_id, builder_id]
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
    [company_id, builder_id]
  );

  // If no templates exist → seed defaults
  if (result.rowCount === 0) {
    await seedInitialPdfTemplates({
      company_id,
      builder_id,
      created_by: user.users_id,
    });

    // Fetch again after seed
    result = await pool.query(
      `
      SELECT *
      FROM template_pdf
      WHERE
        (company_id = $1 AND $1 IS NOT NULL)
        OR (builder_id = $2 AND $2 IS NOT NULL)
      ORDER BY created_at DESC
      `,
      [company_id, builder_id]
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
    [templatePdfId, company_id, builder_id]
  );

  if (result.rowCount === 0) {
    throw new Error("Template not found or access denied");
  }
}

function mergeTemplateImages(existingJson, images) {
  const updated = structuredClone(existingJson);

  if (images.logoImage) {
    updated.logoSettings = updated.logoSettings || {};
    updated.logoSettings.logoImage = images.logoImage;
  }

  if (images.watermarkImage) {
    updated.logoSettings = updated.logoSettings || {};
    updated.logoSettings.watermarkImage = images.watermarkImage;
  }

  return updated;
}

module.exports = {
  createTemplatePdf,
  updateTemplatePdf,
  getTemplatePdfById,
  getTemplatePdfList,
  deleteTemplatePdf,
};
