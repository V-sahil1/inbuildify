const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createContractFormat = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { format_name, dafualt_format, status, builder } = req.body;

    if (!format_name) {
      return errorResponse(res, 400, "format_name is required.");
    }

    const duplicateCheck = await client.query(
      `SELECT contract_format_id 
       FROM contract_format
       WHERE LOWER(format_name) = LOWER($1) 
         AND (company_id = $2 OR builder_id = $3)`,
      [format_name, companyId, builderId],
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Contract format with this name already exists.",
      );
    }

    if (dafualt_format) {
      await client.query(
        `UPDATE contract_format 
         SET dafualt_format = false 
         WHERE (company_id = $1 OR builder_id = $2)`,
        [companyId, builderId],
      );
    }

    await client.query("BEGIN");

    const insertQuery = `
      INSERT INTO contract_format (
        company_id,
        builder_id,
        builder,
        format_name,
        dafualt_format,
        status,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      companyId,
      builderId,
      builder || null,
      format_name,
      dafualt_format || false,
      status !== undefined ? status : true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    const builderInfoQuery = `
      SELECT 
        cf.*,
        b.builder_id as builder_info_id,
        b.name as builder_name
      FROM contract_format cf
      LEFT JOIN builder b ON cf.builder = b.builder_id
      WHERE cf.contract_format_id = $1
    `;

    const builderResult = await client.query(builderInfoQuery, [
      result.rows[0].contract_format_id,
    ]);

    await client.query("COMMIT");

    const transformed = keysToCamelCase(builderResult.rows[0]);
    const finalResponse = {
      ...transformed,
      builder: transformed.builderInfoId
        ? {
            id: transformed.builderInfoId,
            name: transformed.builderName,
          }
        : null,
      builderInfoId: undefined,
      builderName: undefined,
    };

    return successResponse(
      res,
      finalResponse,
      "Contract format created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating contract format:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllContractFormats = async (req, res) => {
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
    const {
      format_name,
      status,
      dafualt_format,
      builder,
      created_at,
      updated_at,
    } = req.query;

    let whereClauses = [];
    let values = [];
    let idx = 1;

    if (builderId) {
      whereClauses.push(`cf.builder_id = $${idx}`);
      values.push(builderId);
      idx++;
    } else {
      whereClauses.push(`cf.company_id = $${idx}`);
      values.push(companyId);
      idx++;
    }

    if (format_name) {
      whereClauses.push(`LOWER(cf.format_name) LIKE LOWER($${idx})`);
      values.push(`%${format_name}%`);
      idx++;
    }

    if (status !== undefined) {
      whereClauses.push(`cf.status = $${idx}`);
      values.push(status === "true");
      idx++;
    }

    if (dafualt_format !== undefined) {
      whereClauses.push(`cf.dafualt_format = $${idx}`);
      values.push(dafualt_format === "true");
      idx++;
    }

    if (builder) {
      whereClauses.push(`cf.builder = $${idx}`);
      values.push(builder);
      idx++;
    }

    if (created_at) {
      let dateFilter;
      const now = new Date();

      switch (created_at.toLowerCase()) {
        case "last_7_days":
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_15_days":
          dateFilter = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
          break;
        case "last_30_days":
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          break;
      }

      if (dateFilter) {
        whereClauses.push(`cf.created_at >= $${idx}`);
        values.push(dateFilter.toISOString());
        idx++;
      }
    }

    if (updated_at) {
      let dateFilter;
      const now = new Date();

      switch (updated_at.toLowerCase()) {
        case "last_7_days":
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_15_days":
          dateFilter = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
          break;
        case "last_30_days":
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          break;
      }

      if (dateFilter) {
        whereClauses.push(`cf.updated_at >= $${idx}`);
        values.push(dateFilter.toISOString());
        idx++;
      }
    }

    const where =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) 
      FROM contract_format cf
      LEFT JOIN builder b ON cf.builder_id = b.builder_id
      ${where}
    `;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT 
        cf.*,
        b.builder_id as builder_info_id,
        b.name as builder_name
      FROM contract_format cf
      LEFT JOIN builder b ON cf.builder = b.builder_id
      ${where}
      ORDER BY cf.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await client.query(dataQuery, values);

    const transformedRows = result.rows.map((row) => {
      const transformed = keysToCamelCase(row);
      return {
        ...transformed,
        builder: transformed.builderInfoId
          ? {
              id: transformed.builderInfoId,
              name: transformed.builderName,
            }
          : null,
        builderInfoId: undefined,
        builderName: undefined,
      };
    });

    return successResponse(res, {
      contractFormats: transformedRows,
      totalRecords: total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching contract formats:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getContractFormatById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { contract_format_id } = req.params;

    const query = `
      SELECT 
        cf.*,
        b.builder_id as builder_info_id,
        b.name as builder_name
      FROM contract_format cf
      LEFT JOIN builder b ON cf.builder = b.builder_id
      WHERE cf.contract_format_id = $1
        AND (cf.company_id = $2 OR cf.builder_id = $3)
    `;

    const result = await client.query(query, [
      contract_format_id,
      companyId,
      builderId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Contract format not found.");
    }

    const transformed = keysToCamelCase(result.rows[0]);
    const finalResponse = {
      ...transformed,
      builder: transformed.builderInfoId
        ? {
            id: transformed.builderInfoId,
            name: transformed.builderName,
          }
        : null,
      builderInfoId: undefined,
      builderName: undefined,
    };

    return successResponse(
      res,
      finalResponse,
      "Contract format retrieved successfully.",
    );
  } catch (err) {
    console.error("Error fetching contract format:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateContractFormat = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { contract_format_id } = req.params;

    const { format_name, dafualt_format, status, builder } = req.body;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT *
      FROM contract_format
      WHERE contract_format_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      contract_format_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Contract format not found.");
    }

    const existing = checkResult.rows[0];
    const fields = [];
    const values = [];
    let index = 4;

    if (format_name !== undefined) {
      const duplicateCheck = await client.query(
        `SELECT contract_format_id 
         FROM contract_format
         WHERE LOWER(format_name) = LOWER($1) 
           AND contract_format_id != $2
           AND (company_id = $3 OR builder_id = $4)`,
        [format_name, contract_format_id, companyId, builderId],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          "Contract format with this name already exists.",
        );
      }

      fields.push(`format_name = $${index}`);
      values.push(format_name);
      index++;
    }

    if (dafualt_format !== undefined) {
      if (dafualt_format && !existing.dafualt_format) {
        await client.query(
          `UPDATE contract_format 
           SET dafualt_format = false 
           WHERE (company_id = $1 OR builder_id = $2)
             AND contract_format_id != $3`,
          [companyId, builderId, contract_format_id],
        );
      }
      fields.push(`dafualt_format = $${index}`);
      values.push(dafualt_format);
      index++;
    }

    if (status !== undefined) {
      fields.push(`status = $${index}`);
      values.push(status);
      index++;
    }

    if (builder !== undefined) {
      fields.push(`builder = $${index}`);
      values.push(builder);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${index}`);
    values.push(userId);
    index++;

    const updateQuery = `
      UPDATE contract_format
      SET ${fields.join(", ")}
      WHERE contract_format_id = $1 
        AND (company_id = $2 OR builder_id = $3)
      RETURNING *;
    `;

    const finalValues = [contract_format_id, companyId, builderId, ...values];
    const updateResult = await client.query(updateQuery, finalValues);

    const builderInfoQuery = `
      SELECT 
        cf.*,
        b.builder_id as builder_info_id,
        b.name as builder_name
      FROM contract_format cf
      LEFT JOIN builder b ON cf.builder = b.builder_id
      WHERE cf.contract_format_id = $1
    `;

    const builderResult = await client.query(builderInfoQuery, [
      contract_format_id,
    ]);

    await client.query("COMMIT");

    const transformed = keysToCamelCase(builderResult.rows[0]);
    const finalResponse = {
      ...transformed,
      builder: transformed.builderInfoId
        ? {
            id: transformed.builderInfoId,
            name: transformed.builderName,
          }
        : null,
      builderInfoId: undefined,
      builderName: undefined,
    };

    return successResponse(
      res,
      finalResponse,
      "Contract format updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating contract format:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteContractFormat = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { contract_format_id } = req.params;

    await client.query("BEGIN");

    // Check if contract format exists
    const checkQuery = `
      SELECT contract_format_id, dafualt_format
      FROM contract_format
      WHERE contract_format_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      contract_format_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Contract format not found.");
    }

    const deleteQuery = `
      DELETE FROM contract_format
      WHERE contract_format_id = $1
        AND (company_id = $2 OR builder_id = $3)
      RETURNING contract_format_id, format_name
    `;

    const result = await client.query(deleteQuery, [
      contract_format_id,
      companyId,
      builderId,
    ]);

    await client.query("COMMIT");

    return successResponse(res, "Contract format deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting contract format:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
