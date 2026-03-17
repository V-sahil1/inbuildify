import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createDocumentCommonFolder(req, res) {
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
        "Invalid user context. Missing builder or company ID.",
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

    const finalSortOrder = sort_order ?? 1;

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM document_common_folder
      WHERE builder_id = $1 OR company_id = $2;
    `;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      builderId,
      companyId,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    await client.query(
      `
      UPDATE document_common_folder
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND (builder_id = $2 OR company_id = $3);
      `,
      [finalSortOrder, builderId, companyId],
    );

    if (role_ids.length > 0) {
      const roleCheckResult = await client.query(
        `
        SELECT role_id
        FROM role
        WHERE role_id = ANY($1::uuid[])
        `,
        [role_ids],
      );

      if (roleCheckResult.rowCount !== role_ids.length) {
        return errorResponse(res, 400, "One or more role IDs are invalid.");
      }
    }

    if (user_ids.length > 0) {
      const userCheckResult = await client.query(
        `
        SELECT users_id
        FROM users
        WHERE users_id = ANY($1::uuid[]) AND is_deleted = false
        `,
        [user_ids],
      );

      if (userCheckResult.rowCount !== user_ids.length) {
        return errorResponse(res, 400, "One or more user IDs are invalid.");
      }
    }

    const insertResult = await client.query(
      `
      INSERT INTO document_common_folder
        (company_id, builder_id, name, sort_order, notify, share_to_customer, is_locked, role_ids, user_ids, created_by, updated_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      RETURNING *;
      `,
      [
        companyId,
        builderId,
        name,
        finalSortOrder,
        notify,
        share_to_customer,
        is_locked,
        role_ids,
        user_ids,
        createdBy,
      ],
    );

    const folder = insertResult.rows[0];

    let roles = [];
    if (folder.role_ids?.length) {
      const roleResult = await client.query(
        `
        SELECT role_id, name AS role_name
        FROM role
        WHERE role_id = ANY($1::uuid[])
        `,
        [folder.role_ids],
      );
      roles = roleResult.rows.map((role) => ({
        id: role.role_id,
        name: role.role_name,
      }));
    }

    let users = [];
    if (folder.user_ids?.length) {
      const userResult = await client.query(
        `
        SELECT users_id, name
        FROM users
        WHERE users_id = ANY($1::uuid[])
        `,
        [folder.user_ids],
      );
      users = userResult.rows.map((user) => ({
        id: user.users_id,
        name: user.name,
      }));
    }

    return successResponse(
      res,
      {
        documentCommonFolderId: folder.document_common_folder_id,
        builderId: folder.builder_id,
        companyId: folder.company_id,
        name: folder.name,
        sortOrder: folder.sort_order,
        notify: folder.notify,
        shareToCustomer: folder.share_to_customer,
        isLocked: folder.is_locked,
        roles,
        users,
        createdBy: folder.created_by,
        updatedBy: folder.updated_by,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      },
      "Document common folder created successfully.",
    );
  } catch (error) {
    console.error("Error creating document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function getAllDocumentCommonFolders(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID.",
      );
    }

    // Get all folders with their subfolders
    const dataQuery = `
      SELECT 
        dcf.document_common_folder_id,
        dcf.builder_id,
        dcf.company_id,
        dcf.name,
        dcf.sort_order,
        dcf.notify,
        dcf.share_to_customer,
        dcf.is_locked,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', r.role_id,
              'name', r.name
            )
          )
          FROM role r
          WHERE r.role_id = ANY(dcf.role_ids)
        ) AS roles,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', u.users_id,
              'name', u.name
            )
          )
          FROM users u
          WHERE u.users_id = ANY(dcf.user_ids)
        ) AS users,
        dcf.created_by,
        dcf.updated_by,
        dcf.created_at,
        dcf.updated_at
      FROM document_common_folder dcf
      WHERE dcf.builder_id = $1 OR dcf.company_id = $2
      ORDER BY dcf.sort_order, dcf.created_at
    `;
    const foldersResult = await client.query(dataQuery, [builderId, companyId]);

    // Get all subfolders for these folders
    const subfoldersQuery = `
      SELECT 
        dcsf.document_common_subfolder_id as "documentCommonSubfolderId",
        dcsf.document_common_folder_id as "documentCommonFolderId",
        dcsf.parent_subfolder_id as "parentSubfolderId",
        dcsf.name,
        dcsf.sort_order,
        dcsf.created_by,
        dcsf.updated_by,
        dcsf.created_at,
        dcsf.updated_at
      FROM document_common_subfolder dcsf
      INNER JOIN document_common_folder dcf ON dcf.document_common_folder_id = dcsf.document_common_folder_id
      WHERE dcf.builder_id = $1 OR dcf.company_id = $2
      ORDER BY dcsf.sort_order, dcsf.name
    `;
    const subfoldersResult = await client.query(subfoldersQuery, [
      builderId,
      companyId,
    ]);

    const folders = keysToCamelCase(foldersResult.rows);
    const subfolders = keysToCamelCase(subfoldersResult.rows);

    // Attach subfolder trees to each folder
    const foldersWithSubfolders = folders.map((folder) => {
      // Filter subfolders that belong to this specific folder
      const folderSubfolders = subfolders.filter(
        (subfolder) =>
          subfolder.documentCommonFolderId === folder.documentCommonFolderId,
      );

      // Build tree structure for this folder's subfolders
      const buildSubfolderTree = (subfolders, parentId = null) => {
        return subfolders
          .filter((subfolder) => subfolder.parentSubfolderId === parentId)
          .map((subfolder) => ({
            ...subfolder,
            subFolder: buildSubfolderTree(
              subfolders,
              subfolder.documentCommonSubfolderId,
            ),
          }));
      };

      return {
        ...folder,
        subfolders: buildSubfolderTree(folderSubfolders, null),
      };
    });

    return successResponse(
      res,
      foldersWithSubfolders,
      "Document common folders with subfolders fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching document common folders:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function deleteDocumentCommonFolder(req, res) {
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
        "Invalid user context. Missing builder or company ID.",
      );
    }

    await client.query("BEGIN");

    const ownershipQuery = `
      SELECT document_common_folder_id, sort_order
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
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not authorized to delete this folder.",
      );
    }

    const deletedSortOrder = ownershipResult.rows[0].sort_order;

    const updateFileNamingRulesQuery = `
      UPDATE document_file_naming_rule 
      SET folder_ids = array_remove(folder_ids, $1)
      WHERE $1 = ANY(folder_ids)
      AND (company_id = $2 OR builder_id = $3)
    `;

    await client.query(updateFileNamingRulesQuery, [
      document_common_folder_id,
      companyId,
      builderId,
    ]);

    const deleteQuery = `
      DELETE FROM document_common_folder
      WHERE document_common_folder_id = $1
      RETURNING *;
    `;
    const deleteResult = await client.query(deleteQuery, [
      document_common_folder_id,
    ]);

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Folder not found or already deleted.");
    }

    const shiftSortOrderQuery = `
      UPDATE document_common_folder
      SET sort_order = sort_order - 1
      WHERE sort_order > $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    await client.query(shiftSortOrderQuery, [
      deletedSortOrder,
      builderId,
      companyId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Document common folder deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function updateDocumentCommonFolder(req, res) {
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
        "Invalid user context. Missing builder or company ID.",
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
        "You are not authorized to update this folder.",
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
        [name, builderId, companyId, document_common_folder_id],
      );
      if (nameCheck.rowCount > 0) {
        return errorResponse(res, 400, `Folder name "${name}" already exists.`);
      }
      fields.push(`name = $${i++}`);
      values.push(name);
    }

    const existingFolder = ownershipResult.rows[0];
    const oldSortOrder = existingFolder.sort_order;
    const newSortOrder = sort_order;

    if (newSortOrder !== undefined && newSortOrder !== null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM document_common_folder
        WHERE builder_id = $1 OR company_id = $2
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        builderId,
        companyId,
      ]);
      const maxSort = maxSortResult.rows[0].max_sort;

      if (newSortOrder < 1 || newSortOrder > maxSort) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSort}.`,
        );
      }

      if (newSortOrder !== oldSortOrder) {
        if (newSortOrder > oldSortOrder) {
          await client.query(
            `
            UPDATE document_common_folder
            SET sort_order = sort_order - 1
            WHERE (builder_id = $1 OR company_id = $2)
              AND sort_order > $3
              AND sort_order <= $4
              AND document_common_folder_id != $5
          `,
            [
              builderId,
              companyId,
              oldSortOrder,
              newSortOrder,
              document_common_folder_id,
            ],
          );
        } else {
          await client.query(
            `
            UPDATE document_common_folder
            SET sort_order = sort_order + 1
            WHERE (builder_id = $1 OR company_id = $2)
              AND sort_order >= $3
              AND sort_order < $4
              AND document_common_folder_id != $5
          `,
            [
              builderId,
              companyId,
              newSortOrder,
              oldSortOrder,
              document_common_folder_id,
            ],
          );
        }
        fields.push(`sort_order = $${i++}`);
        values.push(newSortOrder);
      }
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
          "SELECT role_id FROM role WHERE role_id = ANY($1::uuid[])",
          [role_ids],
        );
        if (validRoles.rowCount !== role_ids.length) {
          return errorResponse(res, 400, "One or more role ids are invalid.");
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
          "SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND is_deleted = false",
          [user_ids],
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
    fields.push("updated_at = NOW()");

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

    const folder = result.rows[0];

    let roles = [];
    if (folder.role_ids?.length) {
      const roleResult = await client.query(
        `
        SELECT role_id, name AS role_name
        FROM role
        WHERE role_id = ANY($1::uuid[])
        `,
        [folder.role_ids],
      );
      roles = roleResult.rows.map((role) => ({
        id: role.role_id,
        name: role.role_name,
      }));
    }

    let users = [];
    if (folder.user_ids?.length) {
      const userResult = await client.query(
        `
        SELECT users_id, name
        FROM users
        WHERE users_id = ANY($1::uuid[])
        `,
        [folder.user_ids],
      );
      users = userResult.rows.map((user) => ({
        id: user.users_id,
        name: user.name,
      }));
    }

    return successResponse(
      res,
      {
        documentCommonFolderId: folder.document_common_folder_id,
        builderId: folder.builder_id,
        companyId: folder.company_id,
        name: folder.name,
        sortOrder: folder.sort_order,
        notify: folder.notify,
        shareToCustomer: folder.share_to_customer,
        isLocked: folder.is_locked,
        roles,
        users,
        createdBy: folder.created_by,
        updatedBy: folder.updated_by,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      },
      "Document common folder updated successfully.",
    );
  } catch (error) {
    console.error("Error updating document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}
