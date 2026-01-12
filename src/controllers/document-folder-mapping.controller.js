const { get } = require("lodash");
const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

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

    let result = await client.query(
      `SELECT * FROM document_folder_mapping
       WHERE (builder_id = $1 OR company_id = $2)
       LIMIT 1`,
      [builderId, companyId]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `INSERT INTO document_folder_mapping (company_id, builder_id, select_all_files_from_folder, created_by, updated_by)
         VALUES ($1, $2, false, $3, $4)
         RETURNING *`,
        [companyId, builderId, req.user?.users_id, req.user?.users_id]
      );
    }

    const getQuery = `
      SELECT 
        dfm.document_folder_mapping_id,
        dfm.company_id,
        dfm.builder_id,
        dfm.select_all_files_from_folder,
        dfm.signed_quotation,
        dfm.signed_color,
        dfm.signed_variation,
        dfm.signed_maintenance,
        dfm.signed_contract_document,
        dfm.compliance_certificate,
        dfm.purchase_order,
        dfm.job_documents,
        dfm.created_by,
        dfm.updated_by,
        dfm.created_at,
        dfm.updated_at
      FROM document_folder_mapping dfm
      WHERE dfm.builder_id = $1 OR dfm.company_id = $2
      ORDER BY dfm.created_at DESC;
    `;

    const getResult = await client.query(getQuery, [builderId, companyId]);

    return successResponse(
      res,
      keysToCamelCase(getResult.rows[0]),
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

    const {
      signed_quotation,
      signed_color,
      signed_variation,
      signed_maintenance,
      signed_contract_document,
      compliance_certificate,
      purchase_order,
      job_documents,
      select_all_files_from_folder,
    } = req.body;

    const folderFields = [
      { name: "signed_quotation", value: signed_quotation },
      { name: "signed_color", value: signed_color },
      { name: "signed_variation", value: signed_variation },
      { name: "signed_maintenance", value: signed_maintenance },
      { name: "signed_contract_document", value: signed_contract_document },
      { name: "compliance_certificate", value: compliance_certificate },
      { name: "purchase_order", value: purchase_order },
      { name: "job_documents", value: job_documents },
    ];

    for (const field of folderFields) {
      if (field.value) {
        const folderCheckQuery = `
          SELECT drive_id
          FROM drive
          WHERE drive_id = $1;
        `;
        const folderCheckResult = await client.query(folderCheckQuery, [
          field.value,
        ]);

        if (folderCheckResult.rowCount === 0) {
          return errorResponse(res, 400, `Invalid ${field.name} folder ID.`);
        }
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (signed_quotation !== undefined) {
      fields.push(`signed_quotation = $${i++}`);
      values.push(signed_quotation);
    }

    if (signed_color !== undefined) {
      fields.push(`signed_color = $${i++}`);
      values.push(signed_color);
    }

    if (signed_variation !== undefined) {
      fields.push(`signed_variation = $${i++}`);
      values.push(signed_variation);
    }

    if (signed_maintenance !== undefined) {
      fields.push(`signed_maintenance = $${i++}`);
      values.push(signed_maintenance);
    }

    if (signed_contract_document !== undefined) {
      fields.push(`signed_contract_document = $${i++}`);
      values.push(signed_contract_document);
    }

    if (compliance_certificate !== undefined) {
      fields.push(`compliance_certificate = $${i++}`);
      values.push(compliance_certificate);
    }

    if (purchase_order !== undefined) {
      fields.push(`purchase_order = $${i++}`);
      values.push(purchase_order);
    }

    if (job_documents !== undefined) {
      fields.push(`job_documents = $${i++}`);
      values.push(job_documents);
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
  UPDATE document_folder_mapping dfm
  SET ${fields.join(", ")}
  WHERE dfm.builder_id = $${i++} OR dfm.company_id = $${i}
  RETURNING 
    dfm.document_folder_mapping_id,
    dfm.company_id,
    dfm.builder_id,
    dfm.select_all_files_from_folder,
    dfm.signed_quotation,
    dfm.signed_color,
    dfm.signed_variation,
    dfm.signed_maintenance,
    dfm.signed_contract_document,
    dfm.compliance_certificate,
    dfm.purchase_order,
    dfm.job_documents,
    dfm.created_by,
    dfm.updated_by,
    dfm.created_at,
    dfm.updated_at
`;

    values.push(builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Failed to update document folder mapping."
      );
    }

    // Fetch the updated record with folder details
    const updatedRecord = await client.query(
      `SELECT 
        *
      FROM document_folder_mapping dfm
      WHERE dfm.document_folder_mapping_id = $1
      `,
      [updateResult.rows[0].document_folder_mapping_id]
    );

    return successResponse(
      res,
      keysToCamelCase(updatedRecord.rows[0]),
      "Document folder mapping updated successfully."
    );
  } catch (err) {
    console.error("Error updating document folder mapping:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error.");
  } finally {
    client.release();
  }
};
