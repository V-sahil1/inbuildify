const getPool = require("../../config/database");
const { keysToCamelCase } = require("../../utils/common");

/**
 * CREATE COST CENTER
 */
async function createCostCenter(payload, builderId, companyId, userId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!companyId && !builderId) {
      throw new Error(
        "User context is invalid: either companyId or builderId must be provided",
      );
    }

    const duplicateCodeCheck = await client.query(
      `
      SELECT cost_center_id 
      FROM cost_center
      WHERE (company_id = $1 OR builder_id = $2)
        AND code = $3
      `,
      [companyId || null, builderId || null, payload.code],
    );

    if (duplicateCodeCheck.rows.length > 0) {
      throw new Error(`Cost center with code ${payload.code} already exists`);
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM cost_center
      WHERE company_id = $1 OR builder_id = $2
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      companyId || null,
      builderId || null,
    ]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    let finalSortOrder;
    if (payload.sortOrder !== undefined) {
      finalSortOrder = payload.sortOrder;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    if (payload.sortOrder !== undefined && payload.sortOrder <= maxSortOrder) {
      const shiftSortOrderQuery = `
        UPDATE cost_center
        SET sort_order = sort_order + 1
        WHERE (company_id = $1 OR builder_id = $2)
          AND sort_order >= $3
      `;
      await client.query(shiftSortOrderQuery, [
        companyId || null,
        builderId || null,
        payload.sortOrder,
      ]);
    }

    const { rows } = await client.query(
      `
      INSERT INTO cost_center
      (company_id, builder_id, code, name, description, sort_order, status, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), $8, $8)
      RETURNING *
      `,
      [
        companyId,
        builderId,
        payload.code,
        payload.name,
        payload.description || null,
        finalSortOrder,
        payload.status || true,
        userId,
      ],
    );

    await client.query("COMMIT");
    return keysToCamelCase(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * GET ALL COST CENTERS
 */
async function getCostCenters(builderId, companyId, filters = {}) {
  const pool = getPool();

  let whereClause = "WHERE (company_id = $1 OR builder_id = $2)";
  let values = [companyId, builderId];
  let paramIndex = 3;

  if (filters.code) {
    whereClause += ` AND code ILIKE $${paramIndex++}`;
    values.push(`%${filters.code}%`);
  }

  if (filters.name) {
    whereClause += ` AND name ILIKE $${paramIndex++}`;
    values.push(`%${filters.name}%`);
  }

  if (filters.description) {
    whereClause += ` AND description ILIKE $${paramIndex++}`;
    values.push(`%${filters.description}%`);
  }

  if (filters.sortOrder !== undefined) {
    whereClause += ` AND sort_order = $${paramIndex++}`;
    values.push(filters.sortOrder);
  } else if (filters.sort_order !== undefined) {
    whereClause += ` AND sort_order = $${paramIndex++}`;
    values.push(filters.sort_order);
  }

  if (filters.status !== undefined) {
    whereClause += ` AND status = $${paramIndex++}`;
    values.push(filters.status);
  }

  const { rows } = await pool.query(
    `
    SELECT *
    FROM cost_center
    ${whereClause}
    ORDER BY sort_order
    `,
    values,
  );

  return keysToCamelCase(rows);
}

/**
 * GET COST CENTER BY ID
 */
async function getCostCenterById(costCenterId, builderId, companyId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT *
    FROM cost_center
    WHERE cost_center_id = $1
      AND (company_id = $2 OR builder_id = $3)
    `,
    [costCenterId, companyId, builderId],
  );

  if (rows.length === 0) {
    throw new Error("Cost center not found");
  }

  return keysToCamelCase(rows[0]);
}

/**
 * UPDATE COST CENTER
 */
async function updateCostCenter(
  costCenterId,
  payload,
  builderId,
  companyId,
  userId,
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT cost_center_id, code, sort_order, company_id, builder_id
      FROM cost_center
      WHERE cost_center_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [costCenterId, companyId, builderId],
    );

    if (existingCheck.rows.length === 0) {
      throw new Error("Cost center not found.");
    }

    const existing = existingCheck.rows[0];

    if (payload.code && payload.code !== existing.code) {
      const duplicateCodeCheck = await client.query(
        `
        SELECT cost_center_id 
        FROM cost_center
        WHERE (company_id = $1 OR builder_id = $2)
          AND code = $3
          AND cost_center_id != $4
        `,
        [companyId, builderId, payload.code, costCenterId],
      );

      if (duplicateCodeCheck.rows.length > 0) {
        throw new Error(`Cost center with code ${payload.code} already exists`);
      }
    }

    if (
      payload.sortOrder !== undefined &&
      payload.sortOrder !== existing.sort_order
    ) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM cost_center
        WHERE company_id = $1 OR builder_id = $2
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [
        companyId,
        builderId,
      ]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      if (payload.sortOrder < 1 || payload.sortOrder > maxSortOrder) {
        throw new Error(
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (payload.sortOrder > existing.sort_order) {
        await client.query(
          `
          UPDATE cost_center
          SET sort_order = sort_order - 1
          WHERE (company_id = $1 OR builder_id = $2)
            AND sort_order > $3
            AND sort_order <= $4
            AND cost_center_id != $5
          `,
          [
            companyId,
            builderId,
            existing.sort_order,
            payload.sortOrder,
            costCenterId,
          ],
        );
      } else {
        await client.query(
          `
          UPDATE cost_center
          SET sort_order = sort_order + 1
          WHERE (company_id = $1 OR builder_id = $2)
            AND sort_order >= $3
            AND sort_order < $4
            AND cost_center_id != $5
          `,
          [
            companyId,
            builderId,
            payload.sortOrder,
            existing.sort_order,
            costCenterId,
          ],
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (payload.code !== undefined) {
      updateFields.push(`code = $${paramIndex++}`);
      updateValues.push(payload.code);
    }

    if (payload.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(payload.name);
    }

    if (payload.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(payload.description);
    }

    if (payload.sortOrder !== undefined) {
      updateFields.push(`sort_order = $${paramIndex++}`);
      updateValues.push(payload.sortOrder);
    }

    if (payload.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(payload.status);
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);
    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    const { rows } = await client.query(
      `
      UPDATE cost_center
      SET ${updateFields.join(", ")}
      WHERE cost_center_id = $${paramIndex}
      RETURNING *
      `,
      [...updateValues, costCenterId],
    );

    // If status is being set to false, delete cost center checklist map records
    if (payload.status === false) {
      await client.query(
        "DELETE FROM cost_center_checklist_map WHERE cost_center_id = $1",
        [costCenterId],
      );
    }

    await client.query("COMMIT");
    return keysToCamelCase(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * DELETE COST CENTER
 */
async function deleteCostCenter(costCenterId, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT cost_center_id, sort_order
      FROM cost_center
      WHERE cost_center_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [costCenterId, companyId, builderId],
    );

    if (existingCheck.rows.length === 0) {
      throw new Error("Cost center not found");
    }

    const existing = existingCheck.rows[0];

    // Remove cost_center_id from all construction_checklist records that reference it
    const updateConstructionChecklistsQuery = `
      UPDATE construction_checklist 
      SET cost_center_id = array_remove(cost_center_id, $1)
      WHERE $1 = ANY(cost_center_id)
      AND (company_id = $2 OR builder_id = $3)
    `;

    await client.query(updateConstructionChecklistsQuery, [
      costCenterId,
      companyId,
      builderId,
    ]);

    await client.query(
      `
      UPDATE cost_center
      SET sort_order = sort_order - 1
      WHERE (company_id = $1 OR builder_id = $2)
        AND sort_order > $3
      `,
      [companyId, builderId, existing.sort_order],
    );

    await client.query("DELETE FROM cost_center WHERE cost_center_id = $1", [
      costCenterId,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * TOGGLE COST CENTER STATUS
 */
async function toggleCostCenterStatus(
  costCenterId,
  builderId,
  companyId,
  userId,
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT cost_center_id, status, company_id, builder_id
      FROM cost_center
      WHERE cost_center_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [costCenterId, companyId, builderId],
    );

    if (existingCheck.rows.length === 0) {
      throw new Error("Cost center not found");
    }

    const existing = existingCheck.rows[0];

    const newStatus = !existing.status;

    const { rows } = await client.query(
      `
      UPDATE cost_center
      SET status = $1, updated_by = $2, updated_at = NOW()
      WHERE cost_center_id = $3
      RETURNING *
      `,
      [newStatus, userId, costCenterId],
    );

    await client.query("COMMIT");
    return keysToCamelCase(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * CREATE COST CENTER CHECKLIST MAP
 */
async function createCostCenterChecklistMap(
  payload,
  builderId,
  companyId,
  userId,
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate cost center exists and belongs to user
    const costCenterCheck = await client.query(
      `
      SELECT cost_center_id, name 
      FROM cost_center
      WHERE cost_center_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [payload.cost_center_id, companyId, builderId],
    );

    if (costCenterCheck.rows.length === 0) {
      throw new Error(
        "Cost center not found or does not belong to your organization",
      );
    }

    // Validate construction checklist exists and belongs to user
    const checklistCheck = await client.query(
      `
      SELECT construction_checklist_id, name 
      FROM construction_checklist
      WHERE construction_checklist_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [payload.construction_checklist_id, companyId, builderId],
    );

    if (checklistCheck.rows.length === 0) {
      throw new Error(
        "Construction checklist not found or does not belong to your organization",
      );
    }

    // Check for duplicate mapping
    const duplicateCheck = await client.query(
      `
      SELECT id 
      FROM cost_center_checklist_map
      WHERE cost_center_id = $1 AND construction_checklist_id = $2
      `,
      [payload.cost_center_id, payload.construction_checklist_id],
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(
        "This cost center is already mapped to this construction checklist",
      );
    }

    const { rows } = await client.query(
      `
      INSERT INTO cost_center_checklist_map
      (cost_center_id, construction_checklist_id)
      VALUES ($1, $2)
      RETURNING *
      `,
      [payload.cost_center_id, payload.construction_checklist_id],
    );

    await client.query("COMMIT");

    // Transform the response to return just IDs
    const newMapping = rows[0];
    return {
      id: newMapping.id,
      costCenterId: newMapping.cost_center_id,
      constructionChecklistId: newMapping.construction_checklist_id,
      createdAt: newMapping.created_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * GET ALL COST CENTER CHECKLIST MAPS
 */
async function getCostCenterChecklistMaps(builderId, companyId, filters = {}) {
  const pool = getPool();

  let whereClause = "WHERE (cc.company_id = $1 OR cc.builder_id = $2)";
  let values = [companyId, builderId];
  let paramIndex = 3;

  if (filters.cost_center_id) {
    whereClause += ` AND cccm.cost_center_id = $${paramIndex++}`;
    values.push(filters.cost_center_id);
  }

  if (filters.construction_checklist_id) {
    whereClause += ` AND cccm.construction_checklist_id = $${paramIndex++}`;
    values.push(filters.construction_checklist_id);
  }

  const { rows } = await pool.query(
    `
    SELECT 
      cccm.id,
      cccm.cost_center_id,
      cccm.construction_checklist_id,
      cccm.created_at
    FROM cost_center_checklist_map cccm
    INNER JOIN cost_center cc ON cc.cost_center_id = cccm.cost_center_id
    INNER JOIN construction_checklist ccl ON ccl.construction_checklist_id = cccm.construction_checklist_id
    ${whereClause}
    ORDER BY cc.sort_order, ccl.sort_order, cccm.created_at DESC
    `,
    values,
  );

  // Transform response to return just IDs
  const mappings = rows.map((row) => ({
    id: row.id,
    costCenterId: row.cost_center_id,
    constructionChecklistId: row.construction_checklist_id,
    createdAt: row.created_at,
  }));

  return keysToCamelCase(mappings);
}

/**
 * DELETE COST CENTER CHECKLIST MAP
 */
async function deleteCostCenterChecklistMap(id, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify the mapping exists and belongs to user's organization
    const existingCheck = await client.query(
      `
      SELECT cccm.id
      FROM cost_center_checklist_map cccm
      INNER JOIN cost_center cc ON cc.cost_center_id = cccm.cost_center_id
      INNER JOIN construction_checklist ccl ON ccl.construction_checklist_id = cccm.construction_checklist_id
      WHERE cccm.id = $1
        AND (cc.company_id = $2 OR cc.builder_id = $3)
        AND (ccl.company_id = $2 OR ccl.builder_id = $3)
      `,
      [id, companyId, builderId],
    );

    if (existingCheck.rows.length === 0) {
      throw new Error(
        "Cost center checklist mapping not found or does not belong to your organization",
      );
    }

    await client.query("DELETE FROM cost_center_checklist_map WHERE id = $1", [
      id,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createCostCenter,
  getCostCenters,
  getCostCenterById,
  updateCostCenter,
  deleteCostCenter,
  toggleCostCenterStatus,
  createCostCenterChecklistMap,
  getCostCenterChecklistMaps,
  deleteCostCenterChecklistMap,
};
