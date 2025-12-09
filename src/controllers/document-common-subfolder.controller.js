const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createDocumentCommonSubfolder = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_common_folder_id, name, sort_order } = req.body;
    const builderId = req.user?.builder_id;
    const createdBy = req.user?.users_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: builder ID missing");
    }

    await client.query("BEGIN");

    const folderQuery = `
      SELECT f.document_common_folder_id, f.builder_id, f.company_id
      FROM document_common_folder f
      WHERE f.document_common_folder_id = $1 AND f.builder_id = $2
    `;
    const folderResult = await client.query(folderQuery, [
      document_common_folder_id,
      builderId,
    ]);

    if (folderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot create a subfolder in another builder's folder."
      );
    }

    const dupNameQuery = `
      SELECT document_common_subfolder_id
      FROM document_common_subfolder
      WHERE document_common_folder_id = $1
        AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      LIMIT 1
    `;
    const dupName = await client.query(dupNameQuery, [
      document_common_folder_id,
      name,
    ]);

    if (dupName.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "A subfolder with this name already exists in this folder."
      );
    }

    const finalSortOrder = sort_order ?? 0;
    const sortCheckQuery = `
      SELECT s.document_common_subfolder_id
      FROM document_common_subfolder s
      INNER JOIN document_common_folder f
        ON f.document_common_folder_id = s.document_common_folder_id
      WHERE f.builder_id = $1
        AND s.document_common_folder_id = $2
        AND s.sort_order = $3
      LIMIT 1
    `;
    const sortCheck = await client.query(sortCheckQuery, [
      builderId,
      document_common_folder_id,
      finalSortOrder,
    ]);

    if (sortCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order ${finalSortOrder} already exists for this folder.`
      );
    }

    const insertQuery = `
      INSERT INTO document_common_subfolder (
        document_common_folder_id,
        name,
        sort_order,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $4)
      RETURNING *
    `;
    const insertResult = await client.query(insertQuery, [
      document_common_folder_id,
      name.trim(),
      finalSortOrder,
      createdBy || null,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Document subfolder created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating document subfolder:", error);
    return errorResponse(res, 500, "Internal server error.");
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
    const { page = 1, limit = 25 } = req.query;

    const offset = (page - 1) * limit;

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
        "Invalid document_common_folder_id for this builder."
      );
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM document_common_subfolder
      WHERE document_common_folder_id = $1
    `;
    const countResult = await client.query(countQuery, [
      document_common_folder_id,
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const getSubfoldersQuery = `
      SELECT 
        dcsf.document_common_subfolder_id,
        dcsf.document_common_folder_id,
        dcsf.name,
        dcsf.sort_order,
        dcsf.created_by,
        dcsf.updated_by,
        dcsf.created_at,
        dcsf.updated_at
      FROM document_common_subfolder dcsf
      WHERE dcsf.document_common_folder_id = $1
      ORDER BY dcsf.sort_order ASC, LOWER(dcsf.name) ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await client.query(getSubfoldersQuery, [
      document_common_folder_id,
      limit,
      offset,
    ]);

    const subfolders = keysToCamelCase(result.rows);

    return successResponse(
      res,
      {
        records: subfolders,
        total,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
      },
      "Document common subfolders fetched successfully."
    );
  } catch (error) {
    console.error(
      "Error fetching document common subfolders by folder_id:",
      error
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
      SELECT s.document_common_subfolder_id
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
        "Invalid subfolder ID or you do not have permission to delete this record."
      );
    }

    const deleteQuery = `
      DELETE FROM document_common_subfolder
      WHERE document_common_subfolder_id = $1
    `;
    await client.query(deleteQuery, [document_common_subfolder_id]);

    return successResponse(
      res,
      null,
      "Document common subfolder deleted successfully."
    );
  } catch (error) {
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
        "Invalid subfolder ID or you do not have permission to update this record."
      );
    }

    const existingData = existingResult.rows[0];
    const document_common_folder_id = existingData.document_common_folder_id;

    if (name && name.trim().toLowerCase() !== existingData.name.toLowerCase()) {
      const duplicateNameQuery = `
        SELECT s.document_common_subfolder_id
        FROM document_common_subfolder s
        INNER JOIN document_common_folder f
          ON f.document_common_folder_id = s.document_common_folder_id
        WHERE f.builder_id = $1
          AND s.document_common_folder_id = $2
          AND LOWER(s.name) = LOWER($3)
          AND s.document_common_subfolder_id <> $4
      `;
      const duplicateNameResult = await client.query(duplicateNameQuery, [
        builderId,
        document_common_folder_id,
        name.trim(),
        document_common_subfolder_id,
      ]);

      if (duplicateNameResult.rows.length > 0) {
        return errorResponse(
          res,
          400,
          "A subfolder with this name already exists in this folder."
        );
      }
    }

    if (
      sort_order !== undefined &&
      sort_order !== null &&
      sort_order !== existingData.sort_order
    ) {
      const duplicateSortOrderQuery = `
        SELECT document_common_subfolder_id
        FROM document_common_subfolder
        WHERE document_common_folder_id = $1
          AND sort_order = $2
          AND document_common_subfolder_id <> $3
      `;
      const duplicateSortOrderResult = await client.query(
        duplicateSortOrderQuery,
        [document_common_folder_id, sort_order, document_common_subfolder_id]
      );

      if (duplicateSortOrderResult.rows.length > 0) {
        return errorResponse(
          res,
          400,
          "A subfolder with this sort order already exists in this folder."
        );
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (sort_order !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(sort_order);
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
    const updatedRecord = updateResult.rows[0];

    return successResponse(
      res,
      updatedRecord,
      "Document common subfolder updated successfully."
    );
  } catch (error) {
    console.error("Error updating document common subfolder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};
