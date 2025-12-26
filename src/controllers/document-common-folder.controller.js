const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createDocumentCommonFolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }
    const {
      name,
      sort_order,
      notify = false,
      share_to_customer = false,
      is_locked = false,
      role_ids = [],
      user_ids = [],
    } = req.body;

    const uniqueNameQuery = `
      SELECT document_common_folder_id
      FROM document_common_folder
      WHERE name = $1 AND (builder_id = $2 OR company_id = $3)
    `;
    const uniqueNameResult = await client.query(uniqueNameQuery, [
      name,
      builderId,
      companyId,
    ]);

    if (uniqueNameResult.rowCount > 0) {
      return errorResponse(res, 400, "Folder name already exists.");
    }

    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const defaultSortCheckQuery = `
    SELECT document_common_folder_id
    FROM document_common_folder
    WHERE sort_order = 0 AND (builder_id = $1 OR company_id = $2)
  `;
      const defaultSortCheckResult = await client.query(defaultSortCheckQuery, [
        builderId,
        companyId,
      ]);
      if (defaultSortCheckResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "Default sort order 0 already exists. Please provide a custom sort_order."
        );
      }
      finalSortOrder = 0;
    } else {
      const uniqueSortQuery = `
    SELECT document_common_folder_id
    FROM document_common_folder
    WHERE sort_order = $1 AND (builder_id = $2 OR company_id = $3)
  `;
      const uniqueSortResult = await client.query(uniqueSortQuery, [
        finalSortOrder,
        builderId,
        companyId,
      ]);
      if (uniqueSortResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          `Sort order ${finalSortOrder} already exists for this builder/company.`
        );
      }
    }

    if (role_ids.length > 0) {
      const roleCheckQuery = `
        SELECT role_id
        FROM role
        WHERE builder_id = $1 AND role_id = ANY($2::uuid[]) AND is_deleted = false
      `;
      const roleCheckResult = await client.query(roleCheckQuery, [
        builderId,
        role_ids,
      ]);
      if (roleCheckResult.rowCount !== role_ids.length) {
        return errorResponse(
          res,
          400,
          "One or more role IDs are invalid for this builder."
        );
      }
    }

    if (role_ids.length > 0) {
      const roleCheckQuery = `
        SELECT role_id
        FROM role
        WHERE builder_id = $1 AND role_id = ANY($2::uuid[]) AND is_active = true
      `;
      const roleCheckResult = await client.query(roleCheckQuery, [
        builderId,
        role_ids,
      ]);
      if (roleCheckResult.rowCount !== role_ids.length) {
        return errorResponse(res, 400, "One or more role IDs are inactive.");
      }
    }

    if (user_ids.length > 0) {
      const userCheckQuery = `
        SELECT users_id
        FROM users
        WHERE  users_id = ANY($1::uuid[]) AND is_deleted = false
      `;
      const userCheckResult = await client.query(userCheckQuery, [user_ids]);
      if (userCheckResult.rowCount !== user_ids.length) {
        return errorResponse(
          res,
          400,
          "One or more user IDs are invalid for this builder/company."
        );
      }
    }

    const insertQuery = `
      INSERT INTO document_common_folder
        (company_id, builder_id, name, sort_order, notify, share_to_customer, is_locked, role_ids, user_ids, created_by, updated_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      RETURNING *;
    `;
    const insertResult = await client.query(insertQuery, [
      companyId,
      builderId,
      name,
      sort_order || 0,
      notify,
      share_to_customer,
      is_locked,
      role_ids,
      user_ids,
      createdBy,
    ]);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Document common folder created successfully."
    );
  } catch (error) {
    console.error("Error creating document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getAllDocumentCommonFolders = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM document_common_folder
      WHERE builder_id = $1 OR company_id = $2
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    const dataQuery = `
      SELECT *
      FROM document_common_folder
      WHERE builder_id = $1 OR company_id = $2
      ORDER BY sort_order, created_at
      LIMIT $3 OFFSET $4
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      companyId,
      limit,
      offset,
    ]);

    return successResponse(
      res,
      {
        folders: dataResult.rows,
        pagination: {
          totalRecords,
          currentPage: page,
          totalPages,
          limit,
        },
      },
      "Document common folders fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching document common folders:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.deleteDocumentCommonFolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_common_folder_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!document_common_folder_id) {
      return errorResponse(res, 400, "Document common folder ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const ownershipQuery = `
      SELECT document_common_folder_id
      FROM document_common_folder
      WHERE document_common_folder_id = $1
        AND (builder_id = $2 OR company_id = $3)
    `;
    const ownershipResult = await client.query(ownershipQuery, [
      document_common_folder_id,
      builderId,
      companyId,
    ]);

    if (ownershipResult.rowCount === 0) {
      return errorResponse(
        res,
        403,
        "You are not authorized to delete this folder."
      );
    }

    const deleteQuery = `
      DELETE FROM document_common_folder
      WHERE document_common_folder_id = $1
      RETURNING *;
    `;
    const deleteResult = await client.query(deleteQuery, [
      document_common_folder_id,
    ]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Folder not found or already deleted.");
    }

    return successResponse(
      res,
      null,
      "Document common folder deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updateDocumentCommonFolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_common_folder_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const updatedBy = req.user?.users_id;

    if (!document_common_folder_id) {
      return errorResponse(res, 400, "Document common folder ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const ownershipQuery = `
      SELECT *
      FROM document_common_folder
      WHERE document_common_folder_id = $1
        AND (builder_id = $2 OR company_id = $3)
    `;
    const ownershipResult = await client.query(ownershipQuery, [
      document_common_folder_id,
      builderId,
      companyId,
    ]);

    if (ownershipResult.rowCount === 0) {
      return errorResponse(
        res,
        403,
        "You are not authorized to update this folder."
      );
    }

    const {
      name,
      sort_order,
      notify,
      share_to_customer,
      is_locked,
      role_ids,
      user_ids,
    } = req.body;

    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined) {
      const nameCheck = await client.query(
        `SELECT document_common_folder_id
         FROM document_common_folder
         WHERE name = $1 AND (builder_id = $2 OR company_id = $3) AND document_common_folder_id != $4`,
        [name, builderId, companyId, document_common_folder_id]
      );
      if (nameCheck.rowCount > 0) {
        return errorResponse(res, 400, `Folder name "${name}" already exists.`);
      }
      fields.push(`name = $${i++}`);
      values.push(name);
    }

    if (sort_order !== undefined) {
      const sortCheck = await client.query(
        `SELECT document_common_folder_id
         FROM document_common_folder
         WHERE sort_order = $1 AND (builder_id = $2 OR company_id = $3) AND document_common_folder_id != $4`,
        [sort_order, builderId, companyId, document_common_folder_id]
      );
      if (sortCheck.rowCount > 0) {
        return errorResponse(
          res,
          400,
          `Sort order ${sort_order} already exists.`
        );
      }
      fields.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }

    if (notify !== undefined) {
      fields.push(`notify = $${i++}`);
      values.push(notify);
    }
    if (share_to_customer !== undefined) {
      fields.push(`share_to_customer = $${i++}`);
      values.push(share_to_customer);
    }
    if (is_locked !== undefined) {
      fields.push(`is_locked = $${i++}`);
      values.push(is_locked);
    }

    if (role_ids !== undefined) {
      if (!Array.isArray(role_ids)) {
        return errorResponse(res, 400, "role_ids must be an array of UUIDs.");
      }
      if (role_ids.length > 0) {
        const validRoles = await client.query(
          `SELECT role_id FROM role WHERE builder_id = $1 AND role_id = ANY($2::uuid[])`,
          [builderId, role_ids]
        );
        if (validRoles.rowCount !== role_ids.length) {
          return errorResponse(res, 400, "One or more role ids are invalid.");
        }
      }

      if (role_ids.length > 0) {
        const validRoles = await client.query(
          `SELECT role_id FROM role WHERE builder_id = $1 AND role_id = ANY($2::uuid[]) AND is_active = true`,
          [builderId, role_ids]
        );
        if (validRoles.rowCount !== role_ids.length) {
          return errorResponse(res, 400, "One or more role ids inactive.");
        }
      }
      fields.push(`role_ids = $${i++}`);
      values.push(role_ids);
    }

    if (user_ids !== undefined) {
      if (!Array.isArray(user_ids)) {
        return errorResponse(res, 400, "user_ids must be an array of UUIDs.");
      }
      if (user_ids.length > 0) {
        const validUsers = await client.query(
          `SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND is_deleted = false`,
          [user_ids]
        );
        if (validUsers.rowCount !== user_ids.length) {
          return errorResponse(res, 400, "One or more user_ids are invalid.");
        }
      }
      fields.push(`user_ids = $${i++}`);
      values.push(user_ids);
    }

    if (!fields.length) {
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(updatedBy);
    fields.push(`updated_at = NOW()`);

    values.push(document_common_folder_id);

    const updateQuery = `
      UPDATE document_common_folder
      SET ${fields.join(", ")}
      WHERE document_common_folder_id = $${i}
      RETURNING *;
    `;
    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Document common folder not found.");
    }

    return successResponse(
      res,
      result.rows[0],
      "Document common folder updated successfully."
    );
  } catch (error) {
    console.error("Error updating document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};
