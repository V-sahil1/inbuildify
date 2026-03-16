import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";
import { deleteFromS3 } from "../../utils/s3Upload";

export async function createCustomSection(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id, file_url, sort_order } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const versionCheck = await client.query(
      `SELECT qv.quotation_version_id, qv.is_approve
       FROM quotation_version qv
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE qv.quotation_version_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [quotation_version_id, companyId, builderId],
    );

    if (versionCheck.rowCount === 0) {
      return errorResponse(res, 404, "Quotation version not found or does not belong to your organization");
    }

    if (versionCheck.rows[0].is_approve === true) {
      return errorResponse(res, 400, "Cannot add custom sections to an approved quotation version");
    }

    let finalSortOrder = sort_order;

    const maxSortResult = await client.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
       FROM quotation_version_custom_section
       WHERE quotation_version_id = $1`,
      [quotation_version_id],
    );

    const maxSortOrder = maxSortResult.rows[0].max_sort_order;

    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = maxSortOrder + 1;
    } else {
      if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
        );
      }

      await client.query(
        `UPDATE quotation_version_custom_section
         SET sort_order = sort_order + 1
         WHERE sort_order >= $1 AND quotation_version_id = $2`,
        [finalSortOrder, quotation_version_id],
      );
    }

    const result = await client.query(
      `INSERT INTO quotation_version_custom_section 
       (quotation_version_id, file_url, sort_order) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [quotation_version_id, file_url || null, finalSortOrder],
    );

    return successResponse(res, keysToCamelCase(result.rows[0]), 201, "Custom section created successfully");
  } catch (error) {
    console.error("Create custom section error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function getCustomSectionsByVersionId(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const versionCheck = await client.query(
      `SELECT qv.quotation_version_id
       FROM quotation_version qv
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE qv.quotation_version_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [quotation_version_id, companyId, builderId],
    );

    if (versionCheck.rowCount === 0) {
      return errorResponse(res, 404, "Quotation version not found or does not belong to your organization");
    }

    const result = await client.query(
      `SELECT * FROM quotation_version_custom_section
       WHERE quotation_version_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [quotation_version_id],
    );

    return successResponse(
      res,
      result.rows.map(row => keysToCamelCase(row)),
      "Custom sections fetched successfully",
    );
  } catch (error) {
    console.error("Get custom sections error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateCustomSection(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { custom_section_id } = req.params;
    const { file_url, sort_order } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const checkResult = await client.query(
      `SELECT cs.*, qv.is_approve
       FROM quotation_version_custom_section cs
       JOIN quotation_version qv ON cs.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE cs.custom_section_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [custom_section_id, companyId, builderId],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Custom section not found or does not belong to your organization");
    }

    if (checkResult.rows[0].is_approve === true) {
      return errorResponse(res, 400, "Cannot modify custom sections of an approved quotation version");
    }

    const existingSection = checkResult.rows[0];

    if (sort_order !== undefined && sort_order !== null) {
      const existingSortOrder = existingSection.sort_order;

      const maxSortResult = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
         FROM quotation_version_custom_section
         WHERE quotation_version_id = $1`,
        [existingSection.quotation_version_id],
      );
      const maxSortOrder = maxSortResult.rows[0].max_sort_order;

      if (sort_order < 1 || sort_order > maxSortOrder) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          await client.query(
            `UPDATE quotation_version_custom_section
             SET sort_order = sort_order - 1
             WHERE sort_order > $1
               AND sort_order <= $2
               AND quotation_version_id = $3
               AND custom_section_id != $4`,
            [existingSortOrder, sort_order, existingSection.quotation_version_id, custom_section_id],
          );
        } else {
          await client.query(
            `UPDATE quotation_version_custom_section
             SET sort_order = sort_order + 1
             WHERE sort_order >= $1
               AND sort_order < $2
               AND quotation_version_id = $3
               AND custom_section_id != $4`,
            [sort_order, existingSortOrder, existingSection.quotation_version_id, custom_section_id],
          );
        }
      }
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (file_url !== undefined) {
      if (existingSection.file_url && file_url !== existingSection.file_url) {
        await deleteFromS3(existingSection.file_url);
      }
      updateFields.push(`file_url = $${paramIndex++}`);
      values.push(file_url);
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramIndex++}`);
      values.push(sort_order);
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "No fields provided for update");
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(custom_section_id);

    const result = await client.query(
      `UPDATE quotation_version_custom_section
       SET ${updateFields.join(", ")}
       WHERE custom_section_id = $${paramIndex}
       RETURNING *`,
      values,
    );

    return successResponse(res, keysToCamelCase(result.rows[0]), "Custom section updated successfully");
  } catch (error) {
    console.error("Update custom section error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function deleteCustomSection(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { custom_section_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const checkResult = await client.query(
      `SELECT cs.*, qv.is_approve
       FROM quotation_version_custom_section cs
       JOIN quotation_version qv ON cs.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE cs.custom_section_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [custom_section_id, companyId, builderId],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Custom section not found or does not belong to your organization");
    }

    if (checkResult.rows[0].is_approve === true) {
      return errorResponse(res, 400, "Cannot delete custom sections from an approved quotation version");
    }

    const deletedSection = checkResult.rows[0];

    if (deletedSection.file_url) {
      await deleteFromS3(deletedSection.file_url);
    }

    await client.query(
      "DELETE FROM quotation_version_custom_section WHERE custom_section_id = $1",
      [custom_section_id],
    );

    await client.query(
      `UPDATE quotation_version_custom_section
       SET sort_order = sort_order - 1
       WHERE sort_order > $1 AND quotation_version_id = $2`,
      [deletedSection.sort_order, deletedSection.quotation_version_id],
    );

    return successResponse(res, null, "Custom section deleted successfully");
  } catch (error) {
    console.error("Delete custom section error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
