const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createDocumentCommonSubfolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_common_folder_id, parent_subfolder_id, name, sort_order } =
      req.body;
    const builderId = req.user?.builder_id;
    const createdBy = req.user?.users_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: builder ID missing");
    }

    if (!document_common_folder_id && !parent_subfolder_id) {
      return errorResponse(
        res,
        400,
        "Either document_common_folder_id or parent_subfolder_id must be provided.",
      );
    }

    await client.query("BEGIN");

    let finalDocumentCommonFolderId = document_common_folder_id;

    // If parent_subfolder_id is provided, get the document_common_folder_id from parent
    if (parent_subfolder_id) {
      const parentQuery = `
        SELECT s.document_common_subfolder_id, s.document_common_folder_id, f.builder_id
        FROM document_common_subfolder s
        INNER JOIN document_common_folder f ON f.document_common_folder_id = s.document_common_folder_id
        WHERE s.document_common_subfolder_id = $1 
          AND f.builder_id = $2
      `;
      const parentResult = await client.query(parentQuery, [
        parent_subfolder_id,
        builderId,
      ]);

      if (parentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid parent subfolder ID or you do not have permission to create subfolder here.",
        );
      }

      // If document_common_folder_id was provided, verify it matches the parent's folder
      if (
        document_common_folder_id &&
        document_common_folder_id !==
        parentResult.rows[0].document_common_folder_id
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Provided document_common_folder_id does not match the parent subfolder's folder.",
        );
      }

      finalDocumentCommonFolderId =
        parentResult.rows[0].document_common_folder_id;
    } else {
      // Verify the main folder belongs to builder
      const folderQuery = `
        SELECT f.document_common_folder_id, f.builder_id, f.company_id
        FROM document_common_folder f
        WHERE f.document_common_folder_id = $1 AND f.builder_id = $2
      `;
      const folderResult = await client.query(folderQuery, [
        finalDocumentCommonFolderId,
        builderId,
      ]);

      if (folderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "You cannot create a subfolder in another builder's folder.",
        );
      }
    }

    // Check for duplicate name within the same parent context
    const dupNameQuery = `
      SELECT document_common_subfolder_id
      FROM document_common_subfolder
      WHERE document_common_folder_id = $1
        AND parent_subfolder_id IS NOT DISTINCT FROM $2
        AND LOWER(TRIM(name)) = LOWER(TRIM($3))
      LIMIT 1
    `;
    const dupName = await client.query(dupNameQuery, [
      finalDocumentCommonFolderId,
      parent_subfolder_id || null,
      name,
    ]);

    if (dupName.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "A subfolder with this name already exists in this location.",
      );
    }

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    // Get maximum sort order within the same parent context
    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM document_common_subfolder
      WHERE document_common_folder_id = $1
        AND parent_subfolder_id IS NOT DISTINCT FROM $2;
    `;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      finalDocumentCommonFolderId,
      parent_subfolder_id || null,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    // Shift sort orders within the same parent context
    const shiftSortOrderQuery = `
      UPDATE document_common_subfolder
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND document_common_folder_id = $2
        AND parent_subfolder_id IS NOT DISTINCT FROM $3;
    `;

    await client.query(shiftSortOrderQuery, [
      finalSortOrder,
      finalDocumentCommonFolderId,
      parent_subfolder_id || null,
    ]);

    const insertQuery = `
      INSERT INTO document_common_subfolder (
        document_common_folder_id,
        parent_subfolder_id,
        name,
        sort_order,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING *
    `;
    const insertResult = await client.query(insertQuery, [
      finalDocumentCommonFolderId,
      parent_subfolder_id || null,
      name.trim(),
      finalSortOrder,
      createdBy || null,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Document subfolder created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating document subfolder:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getDocumentCommonSubfolderTree = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { document_common_folder_id } = req.params;

    const checkFolderQuery = `
      SELECT document_common_folder_id 
      FROM document_common_folder 
      WHERE document_common_folder_id = $1 
        AND (builder_id = $2 OR (builder_id IS NULL AND company_id IS NOT NULL))
    `;
    const checkResult = await client.query(checkFolderQuery, [
      document_common_folder_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid document_common_folder_id for this builder.",
      );
    }

    // Get all subfolders for the folder
    const getAllSubfoldersQuery = `
      SELECT 
        dcsf.document_common_subfolder_id,
        dcsf.document_common_folder_id,
        dcsf.parent_subfolder_id,
        dcsf.name,
        dcsf.sort_order,
        dcsf.created_by,
        dcsf.updated_by,
        dcsf.created_at,
        dcsf.updated_at
      FROM document_common_subfolder dcsf
      WHERE dcsf.document_common_folder_id = $1
      ORDER BY dcsf.sort_order ASC, LOWER(dcsf.name) ASC
    `;
    const allSubfoldersResult = await client.query(getAllSubfoldersQuery, [
      document_common_folder_id,
    ]);

    const allSubfolders = keysToCamelCase(allSubfoldersResult.rows);

    // Build hierarchical tree structure
    const buildTree = (subfolders, parentId = null) => {
      return subfolders
        .filter((subfolder) => subfolder.parentSubfolderId === parentId)
        .map((subfolder) => ({
          ...subfolder,
          subFolder: buildTree(subfolders, subfolder.documentCommonSubfolderId),
        }));
    };

    const tree = buildTree(allSubfolders);

    return successResponse(
      res,
      tree,
      "Document subfolder tree fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching document subfolder tree:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getDocumentCommonSubfolderByFolderId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { document_common_folder_id } = req.params;
    const { parent_subfolder_id } = req.query;

    const checkFolderQuery = `
      SELECT document_common_folder_id 
      FROM document_common_folder 
      WHERE document_common_folder_id = $1 
        AND (builder_id = $2 OR (builder_id IS NULL AND company_id IS NOT NULL))
    `;
    const checkResult = await client.query(checkFolderQuery, [
      document_common_folder_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid document_common_folder_id for this builder.",
      );
    }

    const getSubfoldersQuery = `
      SELECT 
        dcsf.document_common_subfolder_id,
        dcsf.document_common_folder_id,
        dcsf.parent_subfolder_id,
        dcsf.name,
        dcsf.sort_order,
        dcsf.created_by,
        dcsf.updated_by,
        dcsf.created_at,
        dcsf.updated_at
      FROM document_common_subfolder dcsf
      WHERE dcsf.document_common_folder_id = $1
        AND dcsf.parent_subfolder_id IS NOT DISTINCT FROM $2
      ORDER BY dcsf.sort_order ASC, LOWER(dcsf.name) ASC
    `;
    const result = await client.query(getSubfoldersQuery, [
      document_common_folder_id,
      parent_subfolder_id || null,
    ]);

    const subfolders = keysToCamelCase(result.rows);

    return successResponse(
      res,
      subfolders,
      "Document common subfolders fetched successfully.",
    );
  } catch (error) {
    console.error(
      "Error fetching document common subfolders by folder_id:",
      error,
    );
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.deleteDocumentCommonSubfolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { document_common_subfolder_id } = req.params;

    const checkQuery = `
      SELECT s.document_common_subfolder_id, s.sort_order, s.document_common_folder_id, s.parent_subfolder_id
      FROM document_common_subfolder s
      INNER JOIN document_common_folder f
        ON f.document_common_folder_id = s.document_common_folder_id
      WHERE s.document_common_subfolder_id = $1
        AND f.builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [
      document_common_subfolder_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid subfolder ID or you do not have permission to delete this record.",
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;
    const folderId = checkResult.rows[0].document_common_folder_id;
    const parentSubfolderId = checkResult.rows[0].parent_subfolder_id;

    await client.query("BEGIN");

    // Delete the subfolder (cascade will handle child subfolders)
    const deleteQuery = `
      DELETE FROM document_common_subfolder
      WHERE document_common_subfolder_id = $1
    `;
    await client.query(deleteQuery, [document_common_subfolder_id]);

    // Shift sort orders for siblings at the same level
    const shiftSortOrderQuery = `
      UPDATE document_common_subfolder
      SET sort_order = sort_order - 1
      WHERE sort_order > $1
        AND document_common_folder_id = $2
        AND parent_subfolder_id IS NOT DISTINCT FROM $3;
    `;
    await client.query(shiftSortOrderQuery, [
      deletedSortOrder,
      folderId,
      parentSubfolderId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Document common subfolder deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting document common subfolder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updateDocumentCommonSubfolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const updatedBy = req.user?.users_id;
    const { document_common_subfolder_id } = req.params;
    const { name, sort_order } = req.body;

    const existingQuery = `
      SELECT s.*, f.builder_id
      FROM document_common_subfolder s
      INNER JOIN document_common_folder f
        ON f.document_common_folder_id = s.document_common_folder_id
      WHERE s.document_common_subfolder_id = $1
        AND f.builder_id = $2
    `;
    const existingResult = await client.query(existingQuery, [
      document_common_subfolder_id,
      builderId,
    ]);

    if (existingResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid subfolder ID or you do not have permission to update this record.",
      );
    }

    const existingData = existingResult.rows[0];
    const document_common_folder_id = existingData.document_common_folder_id;
    const parent_subfolder_id = existingData.parent_subfolder_id;

    if (name && name.trim().toLowerCase() !== existingData.name.toLowerCase()) {
      const duplicateNameQuery = `
        SELECT s.document_common_subfolder_id
        FROM document_common_subfolder s
        INNER JOIN document_common_folder f
          ON f.document_common_folder_id = s.document_common_folder_id
        WHERE f.builder_id = $1
          AND s.document_common_folder_id = $2
          AND s.parent_subfolder_id IS NOT DISTINCT FROM $3
          AND LOWER(s.name) = LOWER($4)
          AND s.document_common_subfolder_id <> $5
      `;
      const duplicateNameResult = await client.query(duplicateNameQuery, [
        builderId,
        document_common_folder_id,
        parent_subfolder_id,
        name.trim(),
        document_common_subfolder_id,
      ]);

      if (duplicateNameResult.rows.length > 0) {
        return errorResponse(
          res,
          400,
          "A subfolder with this name already exists in this location.",
        );
      }
    }

    const oldSortOrder = existingData.sort_order;
    let newSortOrder = sort_order;

    if (newSortOrder !== undefined && newSortOrder !== null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM document_common_subfolder
        WHERE document_common_folder_id = $1
          AND parent_subfolder_id IS NOT DISTINCT FROM $2
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        document_common_folder_id,
        parent_subfolder_id,
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
            UPDATE document_common_subfolder
            SET sort_order = sort_order - 1
            WHERE document_common_folder_id = $1
              AND parent_subfolder_id IS NOT DISTINCT FROM $2
              AND sort_order > $3
              AND sort_order <= $4
              AND document_common_subfolder_id != $5
          `,
            [
              document_common_folder_id,
              parent_subfolder_id,
              oldSortOrder,
              newSortOrder,
              document_common_subfolder_id,
            ],
          );
        } else {
          await client.query(
            `
            UPDATE document_common_subfolder
            SET sort_order = sort_order + 1
            WHERE document_common_folder_id = $1
              AND parent_subfolder_id IS NOT DISTINCT FROM $2
              AND sort_order >= $3
              AND sort_order < $4
              AND document_common_subfolder_id != $5
          `,
            [
              document_common_folder_id,
              parent_subfolder_id,
              newSortOrder,
              oldSortOrder,
              document_common_subfolder_id,
            ],
          );
        }
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (newSortOrder !== undefined && newSortOrder !== oldSortOrder) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(newSortOrder);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_by = $${paramIndex++}`);
    fields.push(`updated_at = NOW()`);
    values.push(updatedBy);

    values.push(document_common_subfolder_id);

    const updateQuery = `
      UPDATE document_common_subfolder
      SET ${fields.join(", ")}
      WHERE document_common_subfolder_id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, values);
    const updatedRecord = keysToCamelCase(updateResult.rows[0]);

    return successResponse(
      res,
      updatedRecord,
      "Document common subfolder updated successfully.",
    );
  } catch (error) {
    console.error("Error updating document common subfolder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};
