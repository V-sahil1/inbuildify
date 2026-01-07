const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createDocumentFileNamingRule = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const { file_type, folder_ids = [] } = req.body;

    const duplicateCheckQuery = `
      SELECT document_file_naming_rule_id
      FROM document_file_naming_rule
      WHERE LOWER(file_type) = LOWER($1)
        AND (
          (builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3)
        )
    `;

    const duplicateResult = await client.query(duplicateCheckQuery, [
      file_type.trim(),
      builderId,
      companyId,
    ]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "A naming rule for this file type already exists for this builder."
      );
    }

    if (folder_ids.length > 0) {
      const folderCheckQuery = `
        SELECT document_common_folder_id
        FROM document_common_folder
        WHERE document_common_folder_id = ANY($1)
        AND (
          (builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3)
        )
      `;
      const folderCheckResult = await client.query(folderCheckQuery, [
        folder_ids,
        builderId,
        companyId,
      ]);

      if (folderCheckResult.rows.length !== folder_ids.length) {
        return errorResponse(
          res,
          400,
          "One or more folder IDs are invalid or do not belong to this builder/company."
        );
      }
    }

    const insertQuery = `
      INSERT INTO document_file_naming_rule (
        company_id,
        builder_id,
        file_type,
        folder_ids,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const insertValues = [
      companyId,
      builderId,
      file_type.trim(),
      folder_ids,
      userId,
      userId,
    ];

    const insertResult = await client.query(insertQuery, insertValues);

    let folderNames = [];
    if (folder_ids && folder_ids.length > 0) {
      const folderQuery = `
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', dcf.document_common_folder_id,
            'name', dcf.name
          )
        )
        FROM document_common_folder dcf
        WHERE dcf.document_common_folder_id = ANY($1)
      `;
      const folderResult = await client.query(folderQuery, [folder_ids]);
      folderNames = folderResult.rows[0]?.jsonb_agg || [];
    }

    const responseData = {
      ...keysToCamelCase(insertResult.rows[0]),
      folderIds: folder_ids || [],
      folderNames: folderNames
    };

    return successResponse(
      res,
      responseData,
      "Document file naming rule created successfully."
    );
  } catch (error) {
    console.error("Error creating document file naming rule:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getAllDocumentFileNamingRules = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { page = 1, limit = 25 } = req.query;

    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM document_file_naming_rule
      WHERE 
        (builder_id IS NOT NULL AND builder_id = $1)
        OR (company_id IS NOT NULL AND company_id = $2)
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const fetchQuery = `
      SELECT 
        document_file_naming_rule_id,
        company_id,
        builder_id,
        file_type,
        created_by,
        updated_by,
        created_at,
        updated_at,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', dcf.document_common_folder_id,
              'name', dcf.name
            )
          )
          FROM document_common_folder dcf
          WHERE dcf.document_common_folder_id = ANY(document_file_naming_rule.folder_ids)
        ) AS folder_names
      FROM document_file_naming_rule
      WHERE 
        (builder_id IS NOT NULL AND builder_id = $1)
        OR (company_id IS NOT NULL AND company_id = $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await client.query(fetchQuery, [
      builderId,
      companyId,
      limit,
      offset,
    ]);

    const records = keysToCamelCase(result.rows);

    return successResponse(
      res,
      {
        records,
        total,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
      },
      "Document file naming rules fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching document file naming rules:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.deleteDocumentFileNamingRule = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { document_file_naming_rule_id } = req.params;

    if (!document_file_naming_rule_id) {
      return errorResponse(
        res,
        400,
        "document_file_naming_rule_id is required."
      );
    }

    const checkQuery = `
      SELECT document_file_naming_rule_id
      FROM document_file_naming_rule
      WHERE document_file_naming_rule_id = $1
        AND (
          (builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3)
        )
    `;
    const checkResult = await client.query(checkQuery, [
      document_file_naming_rule_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "You are not authorized to delete this document file naming rule or it does not exist."
      );
    }

    const deleteQuery = `
      DELETE FROM document_file_naming_rule
      WHERE document_file_naming_rule_id = $1
      RETURNING *
    `;
    const deleteResult = await client.query(deleteQuery, [
      document_file_naming_rule_id,
    ]);

    return successResponse(
      res,
      null,
      "Document file naming rule deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting document file naming rule:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updateDocumentFileNamingRule = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { document_file_naming_rule_id } = req.params;
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

    const { file_type, folder_ids } = req.body;

    const checkQuery = `
      SELECT * FROM document_file_naming_rule 
      WHERE document_file_naming_rule_id = $1 
      AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      document_file_naming_rule_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No document file naming rule found for this user."
      );
    }

    if (folder_ids && folder_ids.length > 0) {
      const folderCheckQuery = `
        SELECT document_common_folder_id
        FROM document_common_folder
        WHERE document_common_folder_id = ANY($1)
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3));
      `;
      const folderCheckResult = await client.query(folderCheckQuery, [
        folder_ids,
        builderId,
        companyId,
      ]);

      if (folderCheckResult.rowCount !== folder_ids.length) {
        return errorResponse(
          res,
          400,
          "One or more folder IDs are invalid or do not belong to this builder/company."
        );
      }
    }

    if (file_type) {
      const duplicateQuery = `
        SELECT document_file_naming_rule_id
        FROM document_file_naming_rule
        WHERE LOWER(file_type) = LOWER($1)
        AND (builder_id = $2 OR company_id = $3)
        AND document_file_naming_rule_id != $4;
      `;
      const duplicateResult = await client.query(duplicateQuery, [
        file_type.trim(),
        builderId,
        companyId,
        document_file_naming_rule_id,
      ]);

      if (duplicateResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "A document file naming rule with this file type already exists."
        );
      }
    }
    const fields = [];
    const values = [];
    let i = 1;

    if (file_type !== undefined) {
      fields.push(`file_type = $${i++}`);
      values.push(file_type.trim());
    }

    if (folder_ids !== undefined) {
      fields.push(`folder_ids = $${i++}`);
      values.push(folder_ids);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE document_file_naming_rule
      SET ${fields.join(", ")}
      WHERE document_file_naming_rule_id = $${i++}
      AND (builder_id = $${i++} OR company_id = $${i})
      RETURNING *;
    `;

    values.push(document_file_naming_rule_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Failed to update document file naming rule."
      );
    }

    const updatedRule = updateResult.rows[0];

    // Get folder details for response
    let folderNames = [];
    if (updatedRule.folder_ids && updatedRule.folder_ids.length > 0) {
      const folderQuery = `
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', dcf.document_common_folder_id,
            'name', dcf.name
          )
        )
        FROM document_common_folder dcf
        WHERE dcf.document_common_folder_id = ANY($1)
      `;
      const folderResult = await client.query(folderQuery, [updatedRule.folder_ids]);
      folderNames = folderResult.rows[0]?.jsonb_agg || [];
    }

    const responseData = {
      ...keysToCamelCase(updatedRule),
      folderIds: updatedRule.folder_ids || [],
      folderNames: folderNames
    };

    return successResponse(
      res,
      responseData,
      "Document file naming rule updated successfully."
    );
  } catch (err) {
    console.error("Error updating document file naming rule:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.createNamingFormat = async (req, res) => {
const pool = getPool();
const client = await pool.connect();

try {
await client.query('BEGIN');

const builderId = req.user?.builder_id;
const companyId = req.user?.company_id;
const userId = req.user?.users_id;

if (!builderId && !companyId) {
await client.query('ROLLBACK');
return errorResponse(
res,
401,
"Unauthorized: Missing builder or company ID."
);
}

const { naming_format } = req.body;

if (!naming_format || naming_format.trim() === '') {
await client.query('ROLLBACK');
return errorResponse(res, 400, "naming_format is required.");
}

// Delete existing naming format for this user
await client.query(
`
DELETE FROM document_file_naming_format
WHERE (builder_id = $1 OR company_id = $2)
`,
[builderId, companyId]
);

// Insert new naming format
const insertQuery = `
INSERT INTO document_file_naming_format
(builder_id, company_id, naming_format, created_by, updated_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
`;

const result = await client.query(insertQuery, [
builderId,
companyId,
naming_format.trim(),
userId,
userId,
]);

await client.query('COMMIT');

return successResponse(
res,
keysToCamelCase(result.rows[0]),
"Naming format created successfully."
);
} catch (err) {
await client.query('ROLLBACK');
console.error("Error creating naming format:", err);
return errorResponse(res, 500, err.message || "Internal Server Error.");
} finally {
client.release();
}
};

exports.getNamingFormat = async (req, res) => {
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

    const query = `
      SELECT 
        document_file_naming_format_id,
        naming_format,
        created_by,
        created_at,
        updated_by,
        updated_at
      FROM document_file_naming_format
      WHERE (builder_id = $1 OR company_id = $2)
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const result = await client.query(query, [
      builderId,
      companyId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No document file naming rule found for this user."
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Naming format retrieved successfully."
    );
  } catch (err) {
    console.error("Error getting naming format:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};
