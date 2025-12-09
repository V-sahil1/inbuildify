const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createDocumentFolderMapping = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const { mapping_type, folder_id, select_all_files_from_folder } = req.body;

    if (!mapping_type) {
      return errorResponse(res, 400, "Mapping type is required.");
    }

    if (folder_id) {
      const folderCheckQuery = `
        SELECT document_common_folder_id
        FROM document_common_folder
        WHERE document_common_folder_id = $1
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3));
      `;
      const folderCheckResult = await client.query(folderCheckQuery, [
        folder_id,
        builderId,
        companyId,
      ]);

      if (folderCheckResult.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid folder ID or folder does not belong to this builder/company."
        );
      }
    }

    const duplicateQuery = `
      SELECT document_folder_mapping_id
      FROM document_folder_mapping
      WHERE mapping_type = $1
      AND (builder_id = $2 OR company_id = $3);
    `;
    const duplicateResult = await client.query(duplicateQuery, [
      mapping_type,
      builderId,
      companyId,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "A folder mapping with this mapping type already exists."
      );
    }

    const insertQuery = `
      INSERT INTO document_folder_mapping (
        company_id,
        builder_id,
        mapping_type,
        folder_id,
        select_all_files_from_folder,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const insertResult = await client.query(insertQuery, [
      companyId,
      builderId,
      mapping_type,
      folder_id || null,
      select_all_files_from_folder ?? false,
      userId,
      userId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Document folder mapping created successfully."
    );
  } catch (err) {
    console.error("Error creating document folder mapping:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllDocumentFolderMappings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const { page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM document_folder_mapping
      WHERE builder_id = $1 OR company_id = $2;
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const getQuery = `
      SELECT 
        document_folder_mapping_id,
        company_id,
        builder_id,
        mapping_type,
        folder_id,
        select_all_files_from_folder,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM document_folder_mapping
      WHERE builder_id = $1 OR company_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4;
    `;

    const result = await client.query(getQuery, [
      builderId,
      companyId,
      limit,
      offset,
    ]);

    const mappings = keysToCamelCase(result.rows);

    return successResponse(
      res,
      {
        records: mappings,
        total,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
      },
      "Document folder mappings fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching document folder mappings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.updateDocumentFolderMapping = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_folder_mapping_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const { mapping_type, folder_id, select_all_files_from_folder } = req.body;

    const checkQuery = `
      SELECT * FROM document_folder_mapping
      WHERE document_folder_mapping_id = $1
      AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      document_folder_mapping_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or unauthorized to update."
      );
    }

    if (folder_id) {
      const folderCheckQuery = `
        SELECT document_common_folder_id
        FROM document_common_folder
        WHERE document_common_folder_id = $1
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3));
      `;
      const folderCheckResult = await client.query(folderCheckQuery, [
        folder_id,
        builderId,
        companyId,
      ]);
      if (folderCheckResult.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid folder ID or folder does not belong to this builder/company."
        );
      }
    }

    if (mapping_type) {
      const duplicateCheckQuery = `
        SELECT document_folder_mapping_id
        FROM document_folder_mapping
        WHERE mapping_type = $1
        AND (builder_id = $2 OR company_id = $3)
        AND document_folder_mapping_id <> $4;
      `;
      const duplicateResult = await client.query(duplicateCheckQuery, [
        mapping_type,
        builderId,
        companyId,
        document_folder_mapping_id,
      ]);

      if (duplicateResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "A folder mapping with this mapping type already exists."
        );
      }
    }
    const fields = [];
    const values = [];
    let i = 1;

    if (mapping_type !== undefined) {
      fields.push(`mapping_type = $${i++}`);
      values.push(mapping_type);
    }

    if (folder_id !== undefined) {
      fields.push(`folder_id = $${i++}`);
      values.push(folder_id);
    }

    if (select_all_files_from_folder !== undefined) {
      fields.push(`select_all_files_from_folder = $${i++}`);
      values.push(select_all_files_from_folder);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE document_folder_mapping
      SET ${fields.join(", ")}
      WHERE document_folder_mapping_id = $${i++}
      AND (builder_id = $${i++} OR company_id = $${i})
      RETURNING *;
    `;

    values.push(document_folder_mapping_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Failed to update document folder mapping."
      );
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Document folder mapping updated successfully."
    );
  } catch (err) {
    console.error("Error updating document folder mapping:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.deleteDocumentFolderMapping = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_folder_mapping_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const checkQuery = `
      SELECT document_folder_mapping_id 
      FROM document_folder_mapping
      WHERE document_folder_mapping_id = $1
      AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      document_folder_mapping_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or unauthorized to delete."
      );
    }

    const deleteQuery = `
      DELETE FROM document_folder_mapping
      WHERE document_folder_mapping_id = $1
      AND (builder_id = $2 OR company_id = $3)
      RETURNING *;
    `;
    const deleteResult = await client.query(deleteQuery, [
      document_folder_mapping_id,
      builderId,
      companyId,
    ]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Failed to delete document folder mapping."
      );
    }

    return successResponse(
      res,
      null,
      "Document folder mapping deleted successfully."
    );
  } catch (err) {
    console.error("Error deleting document folder mapping:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};
