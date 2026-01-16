const getPool = require("../config/database");

function resolveScope(user) {
  return {
    company_id: user.company_id || null,
    builder_id: user.builder_id || null,
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
      [
        company_id,
        builder_id,
        payload.signature_required,
        payload.minimum_audits,
        user.users_id,
      ]
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
      existing.rows[0].construction_ohs_settings_id,
    ]
  );

  return updated.rows[0];
};

/* -----------------------------
   GET LIST
------------------------------ */
exports.getOhsListService = async (user, filters = {}) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);
  const { field_type, id } = filters;

  const existingRecords = await pool.query(
    `
    SELECT COUNT(*) as count
    FROM construction_ohs_list
    WHERE (company_id = $1 OR builder_id = $2)
    `,
    [company_id, builder_id]
  );

  const recordCount = parseInt(existingRecords.rows[0].count);

  if (recordCount === 0) {
    try {
      const settingsResult = await exports.getSettingsService(user);

      if (settingsResult && settingsResult.construction_ohs_settings_id) {
        const settingsId = settingsResult.construction_ohs_settings_id;

        await pool.query(
          `
            INSERT INTO construction_ohs_list (
              company_id, builder_id, construction_ohs_settings_id, 
              field_type, field_name, description, sort_order, 
              created_by, updated_by
            ) VALUES 
            ($1, $2, $3, 'category', 'Supervisor', null, 1, $4, $4),
            ($1, $2, $3, 'category', 'Supplier', null, 2, $4, $4)
          `,
          [company_id, builder_id, settingsId, user.users_id]
        );
      }
    } catch (error) {
      console.error("OHS Service - Error creating default headers:", error);
    }
  }

  // Build dynamic query with filters
  let query = `
    SELECT *
    FROM construction_ohs_list
    WHERE (company_id = $1 OR builder_id = $2)
  `;
  let queryParams = [company_id, builder_id];
  let paramIndex = 3;

  if (id) {
    if (field_type === "category") {
      query += ` AND field_type = 'category' AND construction_ohs_list_id = $${paramIndex}`;
      queryParams.push(id);
      paramIndex++;
    } else if (field_type === "item") {
      query += ` AND parent_id = $${paramIndex}`;
      queryParams.push(id);
      paramIndex++;
    } else {
      query += ` AND created_by = $${paramIndex}`;
      queryParams.push(id);
      paramIndex++;
    }
  } else if (field_type) {
    query += ` AND field_type = $${paramIndex} AND created_by = $${
      paramIndex + 1
    }`;
    queryParams.push(field_type, user.users_id);
    paramIndex += 2;
  } else {
    query += ` AND created_by = $${paramIndex}`;
    queryParams.push(user.users_id);
    paramIndex++;
  }

  query += ` ORDER BY sort_order ASC`;

  const rows = await pool.query(query, queryParams);

  return rows.rows;
};

/* -----------------------------
   CREATE list item
------------------------------ */
exports.createOhsListItemService = async (user, payload) => {
  const pool = getPool();
  const { company_id, builder_id } = resolveScope(user);

  const settings = await exports.getSettingsService(user);

  // 🔹 FIXED LOGIC: Validate field_type and parent_id
  if (payload.field_type === "category") {
    throw new Error("Cannot create category items. Only items can be created.");
  }

  if (payload.field_type === "item" && !payload.parent_id) {
    throw new Error("Item field type must have parent_id");
  }

  // Validate that parent_id belongs to a category owned by the same user
  if (payload.field_type === "item" && payload.parent_id) {
    const parentCheck = await pool.query(
      `
        SELECT construction_ohs_list_id, field_type, created_by
        FROM construction_ohs_list
        WHERE construction_ohs_list_id = $1
          AND (company_id = $2 OR builder_id = $3)
          AND created_by = $4
          AND field_type = 'category'
      `,
      [payload.parent_id, company_id, builder_id, user.users_id]
    );

    if (parentCheck.rowCount === 0) {
      throw new Error("Parent category not found or access denied");
    }
  }

  // Handle sort order shifting for items during creation
  if (payload.field_type === "item" && payload.sort_order) {
    const shiftQuery = `
      UPDATE construction_ohs_list 
      SET sort_order = sort_order + 1 
      WHERE field_type = 'item' 
        AND (company_id = $1 OR builder_id = $2)
        AND created_by = $3
        AND parent_id = $4
        AND sort_order >= $5
    `;
    await pool.query(shiftQuery, [
      company_id,
      builder_id,
      user.users_id,
      payload.parent_id,
      payload.sort_order,
    ]);
  }

  const result = await pool.query(
    `
      INSERT INTO construction_ohs_list
      (company_id, builder_id, construction_ohs_settings_id, field_type, 
       field_name, description, sort_order, parent_id, add_defaults, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
      RETURNING *
    `,
    [
      company_id,
      builder_id,
      settings.construction_ohs_settings_id,
      payload.field_type,
      payload.field_name || null,
      payload.description,
      payload.sort_order || 1,
      payload.parent_id || null,
      payload.add_defaults || false,
      user.users_id,
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
        AND created_by = $4
    `,
    [id, company_id, builder_id, user.users_id]
  );

  if (existing.rowCount === 0) throw new Error("OHS list item not found");

  //  Prevent field_type updates and validate parent_id for categories
  if (payload.field_type) {
    throw new Error("Cannot update field_type");
  }

  const existingRecord = existing.rows[0];

  // If existing record is category, only allow description and add_defaults updates
  if (existingRecord.field_type === "category") {
    if (payload.sort_order) {
      throw new Error("Cannot update sort_order for category");
    }
    if (payload.parent_id) {
      throw new Error("Category field type cannot have parent_id");
    }
  }

  // If existing record is item, only allow description and sort_order updates
  if (existingRecord.field_type === "item") {
    if (payload.add_defaults !== undefined) {
      throw new Error("Cannot update add_defaults for item");
    }

    // Handle sort order shifting for items
    if (
      payload.sort_order &&
      payload.sort_order !== existingRecord.sort_order
    ) {
      const shiftQuery = `
        UPDATE construction_ohs_list 
        SET sort_order = sort_order + 1 
        WHERE field_type = 'item' 
          AND (company_id = $1 OR builder_id = $2)
          AND created_by = $3
          AND parent_id = $4
          AND sort_order >= $5
          AND construction_ohs_list_id != $6
      `;
      await pool.query(shiftQuery, [
        company_id,
        builder_id,
        user.users_id,
        existingRecord.parent_id,
        payload.sort_order,
        id,
      ]);
    }
  }

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
      id,
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

  // Get the item details before deletion for sort order shifting
  const itemToDelete = await pool.query(
    `
      SELECT sort_order, parent_id, created_by
      FROM construction_ohs_list
      WHERE construction_ohs_list_id = $1
        AND field_type = 'item'
        AND (company_id = $2 OR builder_id = $3)
        AND created_by = $4
    `,
    [id, company_id, builder_id, user.users_id]
  );

  if (itemToDelete.rowCount === 0) {
    throw new Error(
      "Item not found, access denied, or category deletion is not allowed"
    );
  }

  const deletedItem = itemToDelete.rows[0];

  // Delete the item
  const result = await pool.query(
    `
      DELETE FROM construction_ohs_list
      WHERE construction_ohs_list_id = $1
        AND field_type = 'item'
        AND (company_id = $2 OR builder_id = $3)
        AND created_by = $4
    `,
    [id, company_id, builder_id, user.users_id]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Item not found, access denied, or category deletion is not allowed"
    );
  }

  // Shift down items with higher sort order within the same parent category
  const shiftQuery = `
    UPDATE construction_ohs_list 
    SET sort_order = sort_order - 1 
    WHERE field_type = 'item' 
      AND (company_id = $1 OR builder_id = $2)
      AND created_by = $3
      AND parent_id = $4
      AND sort_order > $5
  `;
  await pool.query(shiftQuery, [
    company_id,
    builder_id,
    user.users_id,
    deletedItem.parent_id,
    deletedItem.sort_order,
  ]);
};
