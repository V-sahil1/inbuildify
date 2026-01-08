const getPool = require("../config/database");

function resolveScope(user) {
  return {
    company_id: user.company_id || null,
    builder_id: user.builder_id || null
  };
}

/* -----------------------------
   GET OHS Settings
------------------------------ */
exports.getSettingsService = async (user) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const result = await pool.query(
    `
    SELECT *
    FROM construction_ohs_settings
    WHERE (company_id = $1 OR builder_id = $2)
    LIMIT 1
  `,
    [company_id, builder_id]
  );

  // if not existing → create default row
  if (result.rowCount === 0) {
    const inserted = await pool.query(
      `
      INSERT INTO construction_ohs_settings 
      (company_id, builder_id, created_by, updated_by)
      VALUES ($1,$2,$3,$3)
      RETURNING *
      `,
      [company_id, builder_id, user.users_id]
    );
    return inserted.rows[0];
  }

  return result.rows[0];
};

/* -----------------------------
   UPSERT Settings
------------------------------ */
exports.upsertSettingsService = async (user, payload) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const existing = await pool.query(
    `
      SELECT * FROM construction_ohs_settings
      WHERE (company_id = $1 OR builder_id = $2)
      LIMIT 1
    `,
    [company_id, builder_id]
  );

  if (existing.rowCount === 0) {
    // Insert
    const inserted = await pool.query(
      `
      INSERT INTO construction_ohs_settings 
      (company_id, builder_id, signature_required, minimum_audits, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$5)
      RETURNING *
      `,
      [company_id, builder_id, payload.signature_required, payload.minimum_audits, user.users_id]
    );
    return inserted.rows[0];
  }

  // Update
  const updated = await pool.query(
    `
      UPDATE construction_ohs_settings
      SET signature_required = $1,
          minimum_audits = $2,
          updated_by = $3,
          updated_at = NOW()
      WHERE construction_ohs_settings_id = $4
      RETURNING *
    `,
    [
      payload.signature_required,
      payload.minimum_audits,
      user.users_id,
      existing.rows[0].construction_ohs_settings_id
    ]
  );

  return updated.rows[0];
};

/* -----------------------------
   GET LIST
------------------------------ */
exports.getOhsListService = async (user) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const rows = await pool.query(
    `
      SELECT *
      FROM construction_ohs_list
      WHERE (company_id = $1 OR builder_id = $2)
      ORDER BY sort_order ASC
    `,
    [company_id, builder_id]
  );

  return rows.rows;
};

/* -----------------------------
   CREATE list item
------------------------------ */
exports.createOhsListItemService = async (user, payload) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const settings = await exports.getSettingsService(user);

  const result = await pool.query(
    `
      INSERT INTO construction_ohs_list
      (company_id, builder_id, construction_ohs_settings_id, field_type,
       description, sort_order, parent_id, add_defaults, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
      RETURNING *
    `,
    [
      company_id,
      builder_id,
      settings.construction_ohs_settings_id,
      payload.field_type,
      payload.description,
      payload.sort_order || 1,
      payload.parent_id || null,
      payload.add_defaults || false,
      user.users_id
    ]
  );

  return result.rows[0];
};

/* -----------------------------
   UPDATE list item
------------------------------ */
exports.updateOhsListItemService = async (user, id, payload) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const existing = await pool.query(
    `
      SELECT *
      FROM construction_ohs_list
      WHERE construction_ohs_list_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `,
    [id, company_id, builder_id]
  );

  if (existing.rowCount === 0) throw new Error("OHS list item not found");

  const updated = await pool.query(
    `
      UPDATE construction_ohs_list
      SET
        description = COALESCE($1, description),
        sort_order = COALESCE($2, sort_order),
        add_defaults = COALESCE($3, add_defaults),
        updated_by = $4,
        updated_at = NOW()
      WHERE construction_ohs_list_id = $5
      RETURNING *
    `,
    [
      payload.description || null,
      payload.sort_order || null,
      payload.add_defaults ?? null,
      user.users_id,
      id
    ]
  );

  return updated.rows[0];
};

/* -----------------------------
   DELETE list item
------------------------------ */
exports.deleteOhsListItemService = async (user, id) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const result = await pool.query(
    `
      DELETE FROM construction_ohs_list
      WHERE construction_ohs_list_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `,
    [id, company_id, builder_id]
  );

  if (result.rowCount === 0) throw new Error("Item not found or access denied");
};
