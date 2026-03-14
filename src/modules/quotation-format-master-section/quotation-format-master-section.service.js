const getPool = require("../../config/database");
const { keysToCamelCase } = require("../../utils/common");

// ============================================================
//        MASTER SECTION CRUD OPERATIONS
// ============================================================

async function createMasterSection(currentUser, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { master_name, status } = payload;
    const currentUserId = currentUser.users_id;
    const companyId = currentUser.company_id;
    const builderId = currentUser.builder_id;

    const duplicateCheck = await client.query(
      `SELECT master_section_id FROM master_section WHERE master_name = $1 AND ((company_id = $2 AND company_id IS NOT NULL) OR (builder_id = $3 AND builder_id IS NOT NULL))`,
      [master_name, companyId, builderId],
    );

    if (duplicateCheck.rows.length > 0) {
      throw {
        status: 409,
        message:
          "Master section with this name already exists in the specified scope",
      };
    }

    const { rows } = await client.query(
      `INSERT INTO master_section (company_id, builder_id, master_name, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        companyId,
        builderId,
        master_name,
        status !== undefined ? status : true,
        currentUserId,
        currentUserId,
      ],
    );

    await client.query("COMMIT");
    const newMasterSection = rows[0];
    return {
      masterSectionId: newMasterSection.master_section_id,
      companyId: newMasterSection.company_id,
      builderId: newMasterSection.builder_id,
      masterName: newMasterSection.master_name,
      status: newMasterSection.status,
      createdBy: newMasterSection.created_by,
      updatedBy: newMasterSection.updated_by,
      createdAt: newMasterSection.created_at,
      updatedAt: newMasterSection.updated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMasterSections(currentUser, filters = {}) {
  const pool = getPool();
  const userCompanyId = currentUser.company_id;
  const userBuilderId = currentUser.builder_id;
  const { page = 1, limit = 25, search, status } = filters;
  const offset = (page - 1) * limit;

  let whereClause = "WHERE (ms.company_id = $1 OR ms.builder_id = $2)";
  let values = [userCompanyId, userBuilderId];
  let paramIndex = 3;

  if (search) {
    whereClause += ` AND LOWER(ms.master_name) LIKE LOWER($${paramIndex++})`;
    values.push(`%${search}%`);
  }

  if (status !== undefined) {
    whereClause += ` AND ms.status = $${paramIndex++}`;
    values.push(status);
  }

  const { rows } = await pool.query(
    `SELECT ms.master_section_id, ms.company_id, ms.builder_id, ms.master_name, ms.status, ms.created_by, ms.updated_by, ms.created_at, ms.updated_at, cu.name AS created_by_name, uu.name AS updated_by_name, COALESCE(c.name, b.name) AS organization_name FROM master_section ms LEFT JOIN users cu ON cu.users_id = ms.created_by LEFT JOIN users uu ON uu.users_id = ms.updated_by LEFT JOIN company c ON c.company_id = ms.company_id LEFT JOIN builder b ON b.builder_id = ms.builder_id ${whereClause} ORDER BY ms.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int FROM master_section ms ${whereClause}`,
    values,
  );

  const masterSections = rows.map((row) => ({
    masterSectionId: row.master_section_id,
    companyId: row.company_id,
    builderId: row.builder_id,
    masterName: row.master_name,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
    organizationName: row.organization_name,
  }));

  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    masterSections: keysToCamelCase(masterSections),
    pagination: { currentPage: page, totalPages, totalRecords, limit },
  };
}

async function getMasterSectionById(currentUser, masterSectionId) {
  const pool = getPool();
  const userCompanyId = currentUser.company_id;
  const userBuilderId = currentUser.builder_id;

  const { rows } = await pool.query(
    `SELECT ms.master_section_id, ms.company_id, ms.builder_id, ms.master_name, ms.status, ms.created_by, ms.updated_by, ms.created_at, ms.updated_at, cu.name AS created_by_name, uu.name AS updated_by_name, COALESCE(c.name, b.name) AS organization_name FROM master_section ms LEFT JOIN users cu ON cu.users_id = ms.created_by LEFT JOIN users uu ON uu.users_id = ms.updated_by LEFT JOIN company c ON c.company_id = ms.company_id LEFT JOIN builder b ON b.builder_id = ms.builder_id WHERE ms.master_section_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
    [masterSectionId, userCompanyId, userBuilderId],
  );

  if (rows.length === 0) {
    throw {
      status: 404,
      message:
        "Master section not found or does not belong to your organization",
    };
  }

  const row = rows[0];
  return {
    masterSectionId: row.master_section_id,
    companyId: row.company_id,
    builderId: row.builder_id,
    masterName: row.master_name,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
    organizationName: row.organization_name,
  };
}

async function updateMasterSection(currentUser, masterSectionId, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { master_name, status } = payload;
    const currentUserId = currentUser.users_id;
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const existingCheck = await client.query(
      `SELECT master_section_id, company_id, builder_id, master_name FROM master_section WHERE master_section_id = $1 AND (company_id = $2 OR builder_id = $3)`,
      [masterSectionId, userCompanyId, userBuilderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section not found or does not belong to your organization",
      };
    }

    const existing = existingCheck.rows[0];

    if (master_name && master_name !== existing.master_name) {
      const duplicateCheck = await client.query(
        `SELECT master_section_id FROM master_section WHERE master_name = $1 AND master_section_id != $2 AND ((company_id = $3 AND company_id IS NOT NULL) OR (builder_id = $4 AND builder_id IS NOT NULL))`,
        [
          master_name,
          masterSectionId,
          existing.company_id,
          existing.builder_id,
        ],
      );

      if (duplicateCheck.rows.length > 0) {
        throw {
          status: 409,
          message:
            "Master section with this name already exists in the same scope",
        };
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (master_name !== undefined) {
      updateFields.push(`master_name = $${paramIndex++}`);
      updateValues.push(master_name);
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw {
        status: 400,
        message: "At least one field must be provided for update",
      };
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(currentUserId);

    const { rows } = await client.query(
      `UPDATE master_section SET ${updateFields.join(", ")}, updated_at = NOW() WHERE master_section_id = $${paramIndex++} RETURNING *`,
      [...updateValues, masterSectionId],
    );

    await client.query("COMMIT");
    const updatedMasterSection = rows[0];
    return {
      masterSectionId: updatedMasterSection.master_section_id,
      companyId: updatedMasterSection.company_id,
      builderId: updatedMasterSection.builder_id,
      masterName: updatedMasterSection.master_name,
      status: updatedMasterSection.status,
      createdBy: updatedMasterSection.created_by,
      updatedBy: updatedMasterSection.updated_by,
      createdAt: updatedMasterSection.created_at,
      updatedAt: updatedMasterSection.updated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMasterSection(currentUser, masterSectionId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const existingCheck = await client.query(
      `SELECT master_section_id FROM master_section WHERE master_section_id = $1 AND (company_id = $2 OR builder_id = $3)`,
      [masterSectionId, userCompanyId, userBuilderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section not found or does not belong to your organization",
      };
    }

    await client.query(
      "DELETE FROM master_section WHERE master_section_id = $1",
      [masterSectionId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
//        MASTER SECTION HEADER CRUD OPERATIONS
// ============================================================

async function createMasterSectionHeader(currentUser, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const {
      master_section,
      heading_name,
      effective_start_date,
      effective_end_date,
      sort_order,
      status,
    } = payload;
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const masterSectionCheck = await client.query(
      `SELECT master_section_id, company_id, builder_id FROM master_section WHERE master_section_id = $1 AND (company_id = $2 OR builder_id = $3) AND status = true`,
      [master_section, userCompanyId, userBuilderId],
    );

    if (masterSectionCheck.rows.length === 0) {
      throw {
        status: 404,
        message: "Master section not found or inative",
      };
    }

    if (effective_start_date && effective_end_date) {
      const startDate = new Date(effective_start_date);
      const endDate = new Date(effective_end_date);
      if (startDate > endDate) {
        throw {
          status: 400,
          message: "Effective start date cannot be after effective end date",
        };
      }
    }

    let sortOrder = sort_order;
    if (sortOrder === undefined || sortOrder === null) {
      const maxSortOrder = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort_order FROM master_section_header WHERE master_section = $1`,
        [master_section],
      );
      sortOrder = maxSortOrder.rows[0].next_sort_order;
    } else {
      const maxAllowedQuery = await client.query(
        `SELECT COUNT(*)::int as total_headers FROM master_section_header WHERE master_section = $1`,
        [master_section],
      );
      const maxAllowed = maxAllowedQuery.rows[0].total_headers + 1;

      if (sortOrder > maxAllowed) {
        throw {
          status: 400,
          message: `Sort order cannot exceed ${maxAllowed}. There are currently ${maxAllowedQuery.rows[0].total_headers} headers in this master section.`,
        };
      }
    }

    if (sort_order !== undefined && sort_order !== null) {
      const shiftSortOrderQuery = `
        UPDATE master_section_header
        SET sort_order = sort_order + 1
        WHERE master_section = $1 
          AND sort_order >= $2
      `;
      await client.query(shiftSortOrderQuery, [master_section, sort_order]);
    }

    const { rows } = await client.query(
      `INSERT INTO master_section_header (master_section, heading_name, effective_start_date, effective_end_date, sort_order, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        master_section,
        heading_name,
        effective_start_date,
        effective_end_date,
        sortOrder,
        status !== undefined ? status : true,
      ],
    );

    await client.query("COMMIT");
    const newHeader = rows[0];
    return {
      masterSectionHeaderId: newHeader.master_section_header_id,
      masterSection: newHeader.master_section,
      headingName: newHeader.heading_name,
      effectiveStartDate: newHeader.effective_start_date,
      effectiveEndDate: newHeader.effective_end_date,
      sortOrder: newHeader.sort_order,
      status: newHeader.status,
      createdAt: newHeader.created_at,
      updatedAt: newHeader.updated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMasterSectionHeaders(currentUser, filters = {}) {
  const pool = getPool();
  const userCompanyId = currentUser.company_id;
  const userBuilderId = currentUser.builder_id;
  const { page = 1, limit = 25, search, status, master_section } = filters;
  const offset = (page - 1) * limit;

  let whereClause = "WHERE (ms.company_id = $1 OR ms.builder_id = $2)";
  let values = [userCompanyId, userBuilderId];
  let paramIndex = 3;

  if (master_section) {
    whereClause += ` AND msh.master_section = $${paramIndex++}`;
    values.push(master_section);
  }

  if (search) {
    whereClause += ` AND LOWER(msh.heading_name) LIKE LOWER($${paramIndex++})`;
    values.push(`%${search}%`);
  }

  if (status !== undefined) {
    whereClause += ` AND msh.status = $${paramIndex++}`;
    values.push(status);
  }

  const { rows } = await pool.query(
    `SELECT msh.master_section_header_id, msh.master_section, msh.heading_name, msh.effective_start_date, msh.effective_end_date, msh.sort_order, msh.status, msh.created_at, msh.updated_at, ms.master_name, COALESCE(c.name, b.name) AS organization_name FROM master_section_header msh INNER JOIN master_section ms ON ms.master_section_id = msh.master_section LEFT JOIN company c ON c.company_id = ms.company_id LEFT JOIN builder b ON b.builder_id = ms.builder_id ${whereClause} ORDER BY msh.master_section, msh.sort_order, msh.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int FROM master_section_header msh INNER JOIN master_section ms ON ms.master_section_id = msh.master_section ${whereClause}`,
    values,
  );

  const headers = rows.map((row) => ({
    masterSectionHeaderId: row.master_section_header_id,
    masterSection: row.master_section,
    headingName: row.heading_name,
    effectiveStartDate: row.effective_start_date,
    effectiveEndDate: row.effective_end_date,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    masterName: row.master_name,
    organizationName: row.organization_name,
  }));

  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    headers: keysToCamelCase(headers),
    pagination: { currentPage: page, totalPages, totalRecords, limit },
  };
}

async function getMasterSectionHeaderById(currentUser, headerId) {
  const pool = getPool();
  const userCompanyId = currentUser.company_id;
  const userBuilderId = currentUser.builder_id;

  const { rows } = await pool.query(
    `SELECT msh.master_section_header_id, msh.master_section, msh.heading_name, msh.effective_start_date, msh.effective_end_date, msh.sort_order, msh.status, msh.created_at, msh.updated_at, ms.master_name, COALESCE(c.name, b.name) AS organization_name FROM master_section_header msh INNER JOIN master_section ms ON ms.master_section_id = msh.master_section LEFT JOIN company c ON c.company_id = ms.company_id LEFT JOIN builder b ON b.builder_id = ms.builder_id WHERE msh.master_section_header_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
    [headerId, userCompanyId, userBuilderId],
  );

  if (rows.length === 0) {
    throw {
      status: 404,
      message:
        "Master section header not found or does not belong to your organization",
    };
  }

  const row = rows[0];
  return {
    masterSectionHeaderId: row.master_section_header_id,
    masterSection: row.master_section,
    headingName: row.heading_name,
    effectiveStartDate: row.effective_start_date,
    effectiveEndDate: row.effective_end_date,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    masterName: row.master_name,
    organizationName: row.organization_name,
  };
}

async function updateMasterSectionHeader(currentUser, headerId, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const {
      heading_name,
      effective_start_date,
      effective_end_date,
      sort_order,
      status,
    } = payload;
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const existingCheck = await client.query(
      `SELECT msh.master_section_header_id, msh.master_section, msh.heading_name, msh.sort_order, ms.company_id, ms.builder_id FROM master_section_header msh INNER JOIN master_section ms ON ms.master_section_id = msh.master_section WHERE msh.master_section_header_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
      [headerId, userCompanyId, userBuilderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section header not found or does not belong to your organization",
      };
    }

    const existingHeader = existingCheck.rows[0];
    const existingSortOrder = existingHeader.sort_order;
    const masterSectionId = existingHeader.master_section;

    if (effective_start_date && effective_end_date) {
      const startDate = new Date(effective_start_date);
      const endDate = new Date(effective_end_date);
      if (startDate > endDate) {
        throw {
          status: 400,
          message: "Effective start date cannot be after effective end date",
        };
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (heading_name !== undefined) {
      updateFields.push(`heading_name = $${paramIndex++}`);
      updateValues.push(heading_name);
    }

    if (effective_start_date !== undefined) {
      updateFields.push(`effective_start_date = $${paramIndex++}`);
      updateValues.push(effective_start_date);
    }

    if (effective_end_date !== undefined) {
      updateFields.push(`effective_end_date = $${paramIndex++}`);
      updateValues.push(effective_end_date);
    }

    if (sort_order !== undefined) {
      const maxAllowedQuery = await client.query(
        `SELECT COUNT(*)::int as total_headers FROM master_section_header WHERE master_section = $1`,
        [masterSectionId],
      );
      const maxAllowed = maxAllowedQuery.rows[0].total_headers;

      if (sort_order > maxAllowed) {
        throw {
          status: 400,
          message: `Sort order cannot exceed ${maxAllowed}. There are currently ${maxAllowed} headers in this master section.`,
        };
      }

      updateFields.push(`sort_order = $${paramIndex++}`);
      updateValues.push(sort_order);
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw {
        status: 400,
        message: "At least one field must be provided for update",
      };
    }

    if (sort_order !== undefined && sort_order !== existingSortOrder) {
      await client.query(
        `UPDATE master_section_header SET sort_order = 999999 WHERE master_section_header_id = $1`,
        [headerId],
      );

      if (sort_order > existingSortOrder) {
        await client.query(
          `UPDATE master_section_header SET sort_order = sort_order - 1 WHERE master_section = $1 AND sort_order > $2 AND sort_order <= $3`,
          [masterSectionId, existingSortOrder, sort_order],
        );
      } else {
        await client.query(
          `UPDATE master_section_header SET sort_order = sort_order + 1 WHERE master_section = $1 AND sort_order >= $2 AND sort_order < $3`,
          [masterSectionId, sort_order, existingSortOrder],
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE master_section_header SET ${updateFields.join(", ")}, updated_at = NOW() WHERE master_section_header_id = $${paramIndex++} RETURNING *`,
      [...updateValues, headerId],
    );

    await client.query("COMMIT");
    const updatedHeader = rows[0];
    return {
      masterSectionHeaderId: updatedHeader.master_section_header_id,
      masterSection: updatedHeader.master_section,
      headingName: updatedHeader.heading_name,
      effectiveStartDate: updatedHeader.effective_start_date,
      effectiveEndDate: updatedHeader.effective_end_date,
      sortOrder: updatedHeader.sort_order,
      status: updatedHeader.status,
      createdAt: updatedHeader.created_at,
      updatedAt: updatedHeader.updated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMasterSectionHeader(currentUser, headerId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const existingCheck = await client.query(
      `SELECT msh.master_section_header_id, msh.master_section, msh.sort_order FROM master_section_header msh INNER JOIN master_section ms ON ms.master_section_id = msh.master_section WHERE msh.master_section_header_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
      [headerId, userCompanyId, userBuilderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section header not found or does not belong to your organization",
      };
    }

    const deletedHeader = existingCheck.rows[0];
    const deletedSortOrder = deletedHeader.sort_order;
    const masterSectionId = deletedHeader.master_section;

    await client.query(
      "DELETE FROM master_section_header WHERE master_section_header_id = $1",
      [headerId],
    );

    const shiftSortOrderQuery = `
      UPDATE master_section_header
      SET sort_order = sort_order - 1
      WHERE master_section = $1 
        AND sort_order > $2
    `;
    await client.query(shiftSortOrderQuery, [
      masterSectionId,
      deletedSortOrder,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
//        MASTER SECTION ITEM CRUD OPERATIONS
// ============================================================

async function createMasterSectionItem(currentUser, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const {
      master_section_header_id,
      item_name,
      effective_start_date,
      effective_end_date,
      sort_order,
      status,
    } = payload;
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const headerCheck = await client.query(
      `SELECT msh.master_section_header_id, ms.company_id, ms.builder_id FROM master_section_header msh INNER JOIN master_section ms ON ms.master_section_id = msh.master_section WHERE msh.master_section_header_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
      [master_section_header_id, userCompanyId, userBuilderId],
    );

    if (headerCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section header not found or does not belong to your organization",
      };
    }

    if (effective_start_date && effective_end_date) {
      const startDate = new Date(effective_start_date);
      const endDate = new Date(effective_end_date);
      if (startDate > endDate) {
        throw {
          status: 400,
          message: "Effective start date cannot be after effective end date",
        };
      }
    }

    let sortOrder = sort_order;
    if (sortOrder === undefined || sortOrder === null) {
      const maxSortOrder = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort_order FROM master_section_item WHERE master_section_header_id = $1`,
        [master_section_header_id],
      );
      sortOrder = maxSortOrder.rows[0].next_sort_order;
    } else {
      const maxAllowedQuery = await client.query(
        `SELECT COUNT(*)::int as total_items FROM master_section_item WHERE master_section_header_id = $1`,
        [master_section_header_id],
      );
      const maxAllowed = maxAllowedQuery.rows[0].total_items + 1;

      if (sortOrder > maxAllowed) {
        throw {
          status: 400,
          message: `Sort order cannot exceed ${maxAllowed}. There are currently ${maxAllowedQuery.rows[0].total_items} items in this header.`,
        };
      }
    }

    if (sort_order !== undefined && sort_order !== null) {
      const shiftSortOrderQuery = `
        UPDATE master_section_item
        SET sort_order = sort_order + 1
        WHERE master_section_header_id = $1 
          AND sort_order >= $2
      `;
      await client.query(shiftSortOrderQuery, [
        master_section_header_id,
        sort_order,
      ]);
    }

    const { rows } = await client.query(
      `INSERT INTO master_section_item (master_section_header_id, item_name, effective_start_date, effective_end_date, sort_order, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        master_section_header_id,
        item_name,
        effective_start_date,
        effective_end_date,
        sortOrder,
        status !== undefined ? status : true,
      ],
    );

    await client.query("COMMIT");
    const newItem = rows[0];
    return {
      masterSectionItemId: newItem.master_section_item_id,
      masterSectionHeaderId: newItem.master_section_header_id,
      itemName: newItem.item_name,
      effectiveStartDate: newItem.effective_start_date,
      effectiveEndDate: newItem.effective_end_date,
      sortOrder: newItem.sort_order,
      status: newItem.status,
      createdAt: newItem.created_at,
      updatedAt: newItem.updated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMasterSectionItems(currentUser, filters = {}) {
  const pool = getPool();
  const userCompanyId = currentUser.company_id;
  const userBuilderId = currentUser.builder_id;
  const {
    page = 1,
    limit = 25,
    search,
    status,
    master_section_header_id,
  } = filters;
  const offset = (page - 1) * limit;

  let whereClause = "WHERE (ms.company_id = $1 OR ms.builder_id = $2)";
  let values = [userCompanyId, userBuilderId];
  let paramIndex = 3;

  if (master_section_header_id) {
    whereClause += ` AND msi.master_section_header_id = $${paramIndex++}`;
    values.push(master_section_header_id);
  }

  if (search) {
    whereClause += ` AND LOWER(msi.item_name) LIKE LOWER($${paramIndex++})`;
    values.push(`%${search}%`);
  }

  if (status !== undefined) {
    whereClause += ` AND msi.status = $${paramIndex++}`;
    values.push(status);
  }

  const { rows } = await pool.query(
    `SELECT msi.master_section_item_id, msi.master_section_header_id, msi.item_name, msi.effective_start_date, msi.effective_end_date, msi.sort_order, msi.status, msi.created_at, msi.updated_at, msh.heading_name, ms.master_name, COALESCE(c.name, b.name) AS organization_name FROM master_section_item msi INNER JOIN master_section_header msh ON msh.master_section_header_id = msi.master_section_header_id INNER JOIN master_section ms ON ms.master_section_id = msh.master_section LEFT JOIN company c ON c.company_id = ms.company_id LEFT JOIN builder b ON b.builder_id = ms.builder_id ${whereClause} ORDER BY msh.master_section, msh.sort_order, msi.sort_order, msi.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int FROM master_section_item msi INNER JOIN master_section_header msh ON msh.master_section_header_id = msi.master_section_header_id INNER JOIN master_section ms ON ms.master_section_id = msh.master_section ${whereClause}`,
    values,
  );

  const items = rows.map((row) => ({
    masterSectionItemId: row.master_section_item_id,
    masterSectionHeaderId: row.master_section_header_id,
    itemName: row.item_name,
    effectiveStartDate: row.effective_start_date,
    effectiveEndDate: row.effective_end_date,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    headingName: row.heading_name,
    masterName: row.master_name,
    organizationName: row.organization_name,
  }));

  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    items: keysToCamelCase(items),
    pagination: { currentPage: page, totalPages, totalRecords, limit },
  };
}

async function getMasterSectionItemById(currentUser, itemId) {
  const pool = getPool();
  const userCompanyId = currentUser.company_id;
  const userBuilderId = currentUser.builder_id;

  const { rows } = await pool.query(
    `SELECT msi.master_section_item_id, msi.master_section_header_id, msi.item_name, msi.effective_start_date, msi.effective_end_date, msi.sort_order, msi.status, msi.created_at, msi.updated_at, msh.heading_name, ms.master_name, COALESCE(c.name, b.name) AS organization_name FROM master_section_item msi INNER JOIN master_section_header msh ON msh.master_section_header_id = msi.master_section_header_id INNER JOIN master_section ms ON ms.master_section_id = msh.master_section LEFT JOIN company c ON c.company_id = ms.company_id LEFT JOIN builder b ON b.builder_id = ms.builder_id WHERE msi.master_section_item_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
    [itemId, userCompanyId, userBuilderId],
  );

  if (rows.length === 0) {
    throw {
      status: 404,
      message:
        "Master section item not found or does not belong to your organization",
    };
  }

  const row = rows[0];
  return {
    masterSectionItemId: row.master_section_item_id,
    masterSectionHeaderId: row.master_section_header_id,
    itemName: row.item_name,
    effectiveStartDate: row.effective_start_date,
    effectiveEndDate: row.effective_end_date,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    headingName: row.heading_name,
    masterName: row.master_name,
    organizationName: row.organization_name,
  };
}

async function updateMasterSectionItem(currentUser, itemId, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const {
      item_name,
      effective_start_date,
      effective_end_date,
      sort_order,
      status,
    } = payload;
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const existingCheck = await client.query(
      `SELECT msi.master_section_item_id, msi.item_name, ms.company_id, ms.builder_id FROM master_section_item msi INNER JOIN master_section_header msh ON msh.master_section_header_id = msi.master_section_header_id INNER JOIN master_section ms ON ms.master_section_id = msh.master_section WHERE msi.master_section_item_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
      [itemId, userCompanyId, userBuilderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section item not found or does not belong to your organization",
      };
    }

    if (effective_start_date && effective_end_date) {
      const startDate = new Date(effective_start_date);
      const endDate = new Date(effective_end_date);
      if (startDate > endDate) {
        throw {
          status: 400,
          message: "Effective start date cannot be after effective end date",
        };
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (item_name !== undefined) {
      updateFields.push(`item_name = $${paramIndex++}`);
      updateValues.push(item_name);
    }

    if (effective_start_date !== undefined) {
      updateFields.push(`effective_start_date = $${paramIndex++}`);
      updateValues.push(effective_start_date);
    }

    if (effective_end_date !== undefined) {
      updateFields.push(`effective_end_date = $${paramIndex++}`);
      updateValues.push(effective_end_date);
    }

    if (sort_order !== undefined) {
      const currentItemQuery = await client.query(
        `SELECT msi.sort_order, msi.master_section_header_id FROM master_section_item msi WHERE msi.master_section_item_id = $1`,
        [itemId],
      );

      const currentSortOrder = currentItemQuery.rows[0].sort_order;
      const headerId = currentItemQuery.rows[0].master_section_header_id;

      if (sort_order !== currentSortOrder) {
        if (sort_order < currentSortOrder) {
          await client.query(
            `UPDATE master_section_item SET sort_order = sort_order + 1 
             WHERE master_section_header_id = $1 AND sort_order >= $2 AND sort_order < $3`,
            [headerId, sort_order, currentSortOrder],
          );
        } else {
          await client.query(
            `UPDATE master_section_item SET sort_order = sort_order - 1 
             WHERE master_section_header_id = $1 AND sort_order > $2 AND sort_order <= $3`,
            [headerId, currentSortOrder, sort_order],
          );
        }
      }

      updateFields.push(`sort_order = $${paramIndex++}`);
      updateValues.push(sort_order);
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw {
        status: 400,
        message: "At least one field must be provided for update",
      };
    }

    const { rows } = await client.query(
      `UPDATE master_section_item SET ${updateFields.join(", ")}, updated_at = NOW() WHERE master_section_item_id = $${paramIndex++} RETURNING *`,
      [...updateValues, itemId],
    );

    await client.query("COMMIT");
    const updatedItem = rows[0];
    return {
      masterSectionItemId: updatedItem.master_section_item_id,
      masterSectionHeaderId: updatedItem.master_section_header_id,
      itemName: updatedItem.item_name,
      effectiveStartDate: updatedItem.effective_start_date,
      effectiveEndDate: updatedItem.effective_end_date,
      sortOrder: updatedItem.sort_order,
      status: updatedItem.status,
      createdAt: updatedItem.created_at,
      updatedAt: updatedItem.updated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMasterSectionItem(currentUser, itemId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userCompanyId = currentUser.company_id;
    const userBuilderId = currentUser.builder_id;

    const existingCheck = await client.query(
      `SELECT msi.master_section_item_id, msi.master_section_header_id, msi.sort_order FROM master_section_item msi INNER JOIN master_section_header msh ON msh.master_section_header_id = msi.master_section_header_id INNER JOIN master_section ms ON ms.master_section_id = msh.master_section WHERE msi.master_section_item_id = $1 AND (ms.company_id = $2 OR ms.builder_id = $3)`,
      [itemId, userCompanyId, userBuilderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Master section item not found or does not belong to your organization",
      };
    }

    const deletedItem = existingCheck.rows[0];
    const deletedSortOrder = deletedItem.sort_order;
    const masterSectionHeaderId = deletedItem.master_section_header_id;

    await client.query(
      "DELETE FROM master_section_item WHERE master_section_item_id = $1",
      [itemId],
    );

    const shiftSortOrderQuery = `
      UPDATE master_section_item
      SET sort_order = sort_order - 1
      WHERE master_section_header_id = $1 
        AND sort_order > $2
    `;
    await client.query(shiftSortOrderQuery, [
      masterSectionHeaderId,
      deletedSortOrder,
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
  // Master Section
  createMasterSection,
  getMasterSections,
  getMasterSectionById,
  updateMasterSection,
  deleteMasterSection,
  // Master Section Header
  createMasterSectionHeader,
  getMasterSectionHeaders,
  getMasterSectionHeaderById,
  updateMasterSectionHeader,
  deleteMasterSectionHeader,
  // Master Section Item
  createMasterSectionItem,
  getMasterSectionItems,
  getMasterSectionItemById,
  updateMasterSectionItem,
  deleteMasterSectionItem,
};
