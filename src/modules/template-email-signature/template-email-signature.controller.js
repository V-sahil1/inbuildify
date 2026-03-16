import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createTemplateEmailSignature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const { include_email_signature = false, signature_content } = req.body;

    const duplicateCheckQuery = `
      SELECT template_email_signature_id
      FROM template_email_signature
      WHERE (builder_id IS NOT NULL AND builder_id = $1)
         OR (company_id IS NOT NULL AND company_id = $2)
    `;

    const duplicateResult = await client.query(duplicateCheckQuery, [
      builderId,
      companyId,
    ]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "An email signature record already exists for this builder/company.",
      );
    }

    // if (
    //   include_email_signature &&
    //   (!signature_content || signature_content.trim() === "")
    // ) {
    //   return errorResponse(
    //     res,
    //     400,
    //     "Signature content is required when include_email_signature is true."
    //   );
    // }

    const insertQuery = `
      INSERT INTO template_email_signature (
        company_id,
        builder_id,
        include_email_signature,
        signature_content,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING *
    `;

    const insertValues = [
      companyId,
      builderId,
      include_email_signature,
      signature_content ? signature_content.trim() : null,
      userId,
    ];

    const insertResult = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Template email signature created successfully.",
    );
  } catch (error) {
    console.error("Error creating template email signature:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function getTemplateEmailSignature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    let result = await client.query(
      `SELECT * FROM template_email_signature
       WHERE (builder_id IS NOT NULL AND builder_id = $1)
          OR (company_id IS NOT NULL AND company_id = $2)
       LIMIT 1`,
      [builderId, companyId],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `INSERT INTO template_email_signature 
           (builder_id, company_id, include_email_signature, signature_content, created_by, updated_by)
           VALUES ($1, $2, false, '', $3, $3)
           RETURNING *`,
        [builderId, companyId, userId],
      );
    }

    const { includeEmailSignature, signatureContent } = keysToCamelCase(
      result.rows[0],
    );

    return successResponse(
      res,
      { includeEmailSignature, signatureContent },
      result.rowCount === 0
        ? "Default template email signature created."
        : "Template email signature retrieved successfully.",
    );
  } catch (error) {
    console.error("Error fetching template email signature:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}

export async function updateTemplateEmailSignature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    let { include_email_signature, signature_content } = req.body;

    if (typeof include_email_signature === "string") {
      include_email_signature =
        include_email_signature.toLowerCase() === "true";
    }

    const checkQuery = `
      SELECT *
      FROM template_email_signature
      WHERE ((builder_id IS NOT NULL AND builder_id = $1)
          OR (company_id IS NOT NULL AND company_id = $2))
    `;
    const checkResult = await client.query(checkQuery, [builderId, companyId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "No template email signatures found or you are not authorized to update them.",
      );
    }

    if (
      checkResult.rows.some(
        (record) => record.include_email_signature === false,
      ) &&
      signature_content !== undefined &&
      (include_email_signature === undefined ||
        include_email_signature === false)
    ) {
      return errorResponse(
        res,
        400,
        "You cannot update signature content when include_email_signature is disabled.",
      );
    }

    if (include_email_signature === false) {
      signature_content = null;
    }

    const updateQuery = `
     UPDATE template_email_signature
SET 
  include_email_signature = COALESCE($1::BOOLEAN, include_email_signature),
  signature_content = CASE
    WHEN COALESCE($1::BOOLEAN, include_email_signature) = false THEN NULL
    WHEN $2::TEXT IS NOT NULL THEN $2::TEXT
    ELSE signature_content
  END,
  updated_by = $3,
  updated_at = CURRENT_TIMESTAMP
WHERE ((builder_id IS NOT NULL AND builder_id = $4)
    OR (company_id IS NOT NULL AND company_id = $5))
RETURNING include_email_signature, signature_content;

    `;

    const values = [
      include_email_signature,
      signature_content ? signature_content.trim() : null,
      userId,
      builderId,
      companyId,
    ];

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Template email signature updated successfully.",
    );
  } catch (error) {
    console.error("Error updating template email signature:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
}
