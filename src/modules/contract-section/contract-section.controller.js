import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

export async function createContractSection(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { contract_format_id, section_name, sort_order } = req.body;

    const section_url =
      (req.body.sectionUrl === "" ? null : req.body.sectionUrl) ||
      (req.body.section_url === "" ? null : req.body.section_url);

    if (!contract_format_id) {
      return errorResponse(res, 400, "contract_format_id is required.");
    }

    if (!section_name) {
      return errorResponse(res, 400, "section_name is required.");
    }

    const formatCheck = await client.query(
      `SELECT contract_format_id 
       FROM contract_format
       WHERE contract_format_id = $1 
         AND (company_id = $2 OR builder_id = $3)`,
      [contract_format_id, companyId, builderId],
    );

    if (formatCheck.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Contract format not found or access denied.",
      );
    }

    await client.query("BEGIN");

    if (sort_order && sort_order > 1) {
      await client.query(
        `UPDATE contract_section 
         SET sort_order = sort_order + 1
         WHERE contract_format_id = $1 
           AND sort_order >= $2`,
        [contract_format_id, sort_order],
      );
    }

    let finalSortOrder = sort_order;
    if (!finalSortOrder) {
      const maxOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
        FROM contract_section 
        WHERE contract_format_id = $1
      `;
      const maxOrderResult = await client.query(maxOrderQuery, [
        contract_format_id,
      ]);
      finalSortOrder = maxOrderResult.rows[0].next_order;
    }

    const insertQuery = `
      INSERT INTO contract_section (
        contract_format_id,
        section_name,
        sort_order,
        section_url,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      contract_format_id,
      section_name,
      finalSortOrder,
      section_url || null,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Contract section created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating contract section:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllContractSections(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    let { page = 1, limit = 25 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const offset = (page - 1) * limit;
    const { contract_format_id, section_name } = req.query;

    const whereClauses = [];
    const values = [];
    let idx = 1;

    const formatQuery = `
      SELECT contract_format_id 
      FROM contract_format
      WHERE company_id = $1 OR builder_id = $2
    `;
    const formatResult = await client.query(formatQuery, [
      companyId,
      builderId,
    ]);

    if (formatResult.rowCount === 0) {
      return successResponse(res, {
        contractSections: [],
        totalRecords: 0,
        currentPage: page,
        limit,
        totalPages: 0,
      });
    }

    const formatIds = formatResult.rows.map((row) => row.contract_format_id);
    whereClauses.push(`cs.contract_format_id = ANY($${idx})`);
    values.push(formatIds);
    idx++;

    if (contract_format_id) {
      whereClauses.push(`cs.contract_format_id = $${idx}`);
      values.push(contract_format_id);
      idx++;
    }

    if (section_name) {
      whereClauses.push(`LOWER(cs.section_name) LIKE LOWER($${idx})`);
      values.push(`%${section_name}%`);
      idx++;
    }

    const where =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM contract_section cs ${where}`;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT *
      FROM contract_section cs
      ${where}
      ORDER BY cs.contract_format_id, cs.sort_order ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await client.query(dataQuery, values);

    return successResponse(res, {
      contractSections: keysToCamelCase(result.rows),
      totalRecords: total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching contract sections:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getContractSectionById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { contract_section_id } = req.params;

    const query = `
      SELECT cs.*
      FROM contract_section cs
      JOIN contract_format cf ON cs.contract_format_id = cf.contract_format_id
      WHERE cs.contract_section_id = $1
        AND (cf.company_id = $2 OR cf.builder_id = $3)
    `;

    const result = await client.query(query, [
      contract_section_id,
      companyId,
      builderId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Contract section not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Contract section retrieved successfully.",
    );
  } catch (err) {
    console.error("Error fetching contract section:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateContractSection(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { contract_section_id } = req.params;

    const { section_name, sort_order } = req.body;

    const section_url =
      (req.body.sectionUrl === "" ? null : req.body.sectionUrl) ||
      (req.body.section_url === "" ? null : req.body.section_url);

    await client.query("BEGIN");

    const checkQuery = `
      SELECT cs.*, cf.contract_format_id
      FROM contract_section cs
      JOIN contract_format cf ON cs.contract_format_id = cf.contract_format_id
      WHERE cs.contract_section_id = $1
        AND (cf.company_id = $2 OR cf.builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      contract_section_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Contract section not found.");
    }

    const existing = checkResult.rows[0];
    const contractFormatId = existing.contract_format_id;
    const fields = [];
    const values = [];
    let index = 4;

    if (section_name !== undefined) {
      fields.push(`section_name = $${index}`);
      values.push(section_name);
      index++;
    }

    if (sort_order !== undefined && sort_order !== existing.sort_order) {
      if (sort_order > existing.sort_order) {
        await client.query(
          `UPDATE contract_section 
           SET sort_order = sort_order - 1
           WHERE contract_format_id = $1 
             AND sort_order > $2 
             AND sort_order <= $3
             AND contract_section_id != $4`,
          [
            contractFormatId,
            existing.sort_order,
            sort_order,
            contract_section_id,
          ],
        );
      } else {
        await client.query(
          `UPDATE contract_section 
           SET sort_order = sort_order + 1
           WHERE contract_format_id = $1 
             AND sort_order >= $2 
             AND sort_order < $3
             AND contract_section_id != $4`,
          [
            contractFormatId,
            sort_order,
            existing.sort_order,
            contract_section_id,
          ],
        );
      }

      fields.push(`sort_order = $${index}`);
      values.push(sort_order);
      index++;
    }

    if (section_url !== undefined) {
      if (section_url !== existing.section_url && existing.section_url) {
        await deleteFromS3(existing.section_url);
      }
      fields.push(`section_url = $${index}`);
      values.push(section_url);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE contract_section cs
      SET ${fields.join(", ")}
      FROM contract_format cf
      WHERE cs.contract_section_id = $1 
        AND cs.contract_format_id = cf.contract_format_id
        AND (cf.company_id = $2 OR cf.builder_id = $3)
      RETURNING cs.*
    `;

    const finalValues = [contract_section_id, companyId, builderId, ...values];
    const updateResult = await client.query(updateQuery, finalValues);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Contract section updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating contract section:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteContractSection(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { contract_section_id } = req.params;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT cs.*, cf.contract_format_id, cs.sort_order
      FROM contract_section cs
      JOIN contract_format cf ON cs.contract_format_id = cf.contract_format_id
      WHERE cs.contract_section_id = $1
        AND (cf.company_id = $2 OR cf.builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      contract_section_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Contract section not found.");
    }

    const sectionToDelete = checkResult.rows[0];
    const contractFormatId = sectionToDelete.contract_format_id;
    const deletedSortOrder = sectionToDelete.sort_order;
    const oldImageUrl = sectionToDelete.section_url;

    if (oldImageUrl) {
      await deleteFromS3(oldImageUrl);
    }

    const deleteQuery = `
      DELETE FROM contract_section cs
      USING contract_format cf
      WHERE cs.contract_section_id = $1 
        AND cs.contract_format_id = cf.contract_format_id
        AND (cf.company_id = $2 OR cf.builder_id = $3)
      RETURNING cs.contract_section_id, cs.section_name
    `;

    const result = await client.query(deleteQuery, [
      contract_section_id,
      companyId,
      builderId,
    ]);

    await client.query(
      `UPDATE contract_section 
       SET sort_order = sort_order - 1
       WHERE contract_format_id = $1 
         AND sort_order > $2`,
      [contractFormatId, deletedSortOrder],
    );

    await client.query("COMMIT");

    return successResponse(res, "Contract section deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting contract section:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
