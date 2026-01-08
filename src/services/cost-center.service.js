const getPool = require("../config/database");

/**
 * CREATE COST CENTER
 */
async function createCostCenter(payload, builderId, companyId, userId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate user context - at least one of companyId or builderId must be provided
    if (!companyId && !builderId) {
      throw new Error("User context is invalid: either companyId or builderId must be provided");
    }

    // Check for duplicate code within the same scope
    const duplicateCodeCheck = await client.query(
      `
      SELECT cost_center_id 
      FROM cost_center
      WHERE (company_id = $1 OR builder_id = $2)
        AND code = $3
      `,
      [
        companyId || null,
        builderId || null,
        payload.code
      ]
    );

    if (duplicateCodeCheck.rows.length > 0) {
      throw new Error(`Cost center with code ${payload.code} already exists`);
    }

    // Get max sort_order for the scope
    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM cost_center
      WHERE company_id = $1 OR builder_id = $2
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      companyId || null,
      builderId || null
    ]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    let finalSortOrder;
    if (payload.sortOrder !== undefined) {
      finalSortOrder = payload.sortOrder;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    // Validate sort order range
    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
    }

    // Shift sort orders if inserting at a specific position
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
        payload.sortOrder
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
        companyId, // Will be null if user is builder
        builderId, // Will be null if user is company
        payload.code,
        payload.name,
        payload.description || null,
        finalSortOrder,
        payload.status,
        userId // Use actual user ID for created_by/updated_by
      ]
    );

    await client.query("COMMIT");
    return rows[0];
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
async function getCostCenters(builderId, companyId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT *
    FROM cost_center
    WHERE company_id = $1 OR builder_id = $2
    ORDER BY sort_order
    `,
    [companyId, builderId]
  );

  return rows;
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
    [costCenterId, companyId, builderId]
  );

  if (rows.length === 0) {
    throw new Error("Cost center not found");
  }

  return rows[0];
}

/**
 * UPDATE COST CENTER
 */
async function updateCostCenter(costCenterId, payload, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if cost center exists and belongs to the user's scope
    const existingCheck = await client.query(
      `
      SELECT cost_center_id, code, sort_order, company_id, builder_id
      FROM cost_center
      WHERE cost_center_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [costCenterId, companyId, builderId]
    );

    if (existingCheck.rows.length === 0) {
      throw new Error("Cost center not found");
    }

    const existing = existingCheck.rows[0];

    // Check for duplicate code (excluding current cost center)
    if (payload.code && payload.code !== existing.code) {
      const duplicateCodeCheck = await client.query(
        `
        SELECT cost_center_id 
        FROM cost_center
        WHERE (company_id = $1 OR builder_id = $2)
          AND code = $3
          AND cost_center_id != $4
        `,
        [companyId, builderId, payload.code, costCenterId]
      );

      if (duplicateCodeCheck.rows.length > 0) {
        throw new Error(`Cost center with code ${payload.code} already exists`);
      }
    }

    // Handle sort order changes
    if (payload.sortOrder !== undefined && payload.sortOrder !== existing.sort_order) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM cost_center
        WHERE company_id = $1 OR builder_id = $2
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [companyId, builderId]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      // Validate sort order range
      if (payload.sortOrder < 1 || payload.sortOrder > maxSortOrder) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`);
      }

      // Shift sort orders based on movement direction
      if (payload.sortOrder > existing.sort_order) {
        // Moving down: decrement sort_order for cost centers between old and new position
        await client.query(
          `
          UPDATE cost_center
          SET sort_order = sort_order - 1
          WHERE (company_id = $1 OR builder_id = $2)
            AND sort_order > $3
            AND sort_order <= $4
            AND cost_center_id != $5
          `,
          [companyId, builderId, existing.sort_order, payload.sortOrder, costCenterId]
        );
      } else {
        // Moving up: increment sort_order for cost centers between new and old position
        await client.query(
          `
          UPDATE cost_center
          SET sort_order = sort_order + 1
          WHERE (company_id = $1 OR builder_id = $2)
            AND sort_order >= $3
            AND sort_order < $4
            AND cost_center_id != $5
          `,
          [companyId, builderId, payload.sortOrder, existing.sort_order, costCenterId]
        );
      }
    }

    // Build dynamic update query
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
    updateValues.push(builderId || companyId);
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
      [...updateValues, costCenterId]
    );

    await client.query("COMMIT");
    return rows[0];
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

    // Check if cost center exists and belongs to the user's scope
    const existingCheck = await client.query(
      `
      SELECT cost_center_id, sort_order
      FROM cost_center
      WHERE cost_center_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [costCenterId, companyId, builderId]
    );

    if (existingCheck.rows.length === 0) {
      throw new Error("Cost center not found");
    }

    const existing = existingCheck.rows[0];

    // Shift sort orders of cost centers that come after the deleted one
    await client.query(
      `
      UPDATE cost_center
      SET sort_order = sort_order - 1
      WHERE (company_id = $1 OR builder_id = $2)
        AND sort_order > $3
      `,
      [companyId, builderId, existing.sort_order]
    );

    // Delete the cost center
    await client.query(
      "DELETE FROM cost_center WHERE cost_center_id = $1",
      [costCenterId]
    );

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
  deleteCostCenter
};
