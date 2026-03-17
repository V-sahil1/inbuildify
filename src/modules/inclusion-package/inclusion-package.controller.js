import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createInclusionPackage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Organization ID missing.");
    }

    const { name } = req.body;

    const duplicateCheck = await client.query(
      "SELECT inclusion_package_id FROM inclusion_package WHERE LOWER(name) = $1 AND (company_id = $2 OR builder_id = $3)",
      [name.toLowerCase().trim(), companyId, builderId],
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 409, "Inclusion package name already exists in your organization.");
    }

    const result = await client.query(
      `INSERT INTO inclusion_package (company_id, builder_id, name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, builderId, name.trim(), userId, userId],
    );

    return successResponse(res, keysToCamelCase(result.rows[0]), "Inclusion package created successfully.");
  } catch (error) {
    console.error("Error creating inclusion package:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function getAllInclusionPackages(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { name } = req.query;

    const conditions = [];
    const values = [];
    let i = 1;

    if (builderId) {
      conditions.push(`builder_id = $${i++}`);
      values.push(builderId);
    } else {
      conditions.push(`company_id = $${i++}`);
      values.push(companyId);
    }

    if (name) {
      conditions.push(`LOWER(name) LIKE LOWER($${i++})`);
      values.push(`%${name.trim()}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query(
      `SELECT * FROM inclusion_package ${whereClause} ORDER BY created_at DESC`,
      values,
    );

    return successResponse(res, result.rows.map(keysToCamelCase), "Inclusion packages fetched successfully.");
  } catch (error) {
    console.error("Error fetching inclusion packages:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function getInclusionPackageById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;

    const result = await client.query(
      "SELECT * FROM inclusion_package WHERE inclusion_package_id = $1 AND (company_id = $2 OR builder_id = $3)",
      [id, companyId, builderId],
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Inclusion package not found or access denied.");
    }

    return successResponse(res, keysToCamelCase(result.rows[0]));
  } catch (error) {
    console.error("Error fetching inclusion package:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function updateInclusionPackage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return errorResponse(res, 400, "Name is required to update.");
    }

    await client.query("BEGIN");

    const checkRes = await client.query(
      "SELECT * FROM inclusion_package WHERE inclusion_package_id = $1 AND (company_id = $2 OR builder_id = $3) FOR UPDATE",
      [id, companyId, builderId],
    );

    if (checkRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inclusion package not found or access denied.");
    }

    const duplicateCheck = await client.query(
      "SELECT inclusion_package_id FROM inclusion_package WHERE LOWER(name) = $1 AND (company_id = $2 OR builder_id = $3) AND inclusion_package_id != $4",
      [name.toLowerCase().trim(), companyId, builderId, id],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Inclusion package name already exists in your organization.");
    }

    const result = await client.query(
      "UPDATE inclusion_package SET name = $1, updated_by = $2, updated_at = NOW() WHERE inclusion_package_id = $3 RETURNING *",
      [name.trim(), userId, id],
    );

    await client.query("COMMIT");
    return successResponse(res, keysToCamelCase(result.rows[0]), "Inclusion package updated successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating inclusion package:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function deleteInclusionPackage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;

    const result = await client.query(
      "DELETE FROM inclusion_package WHERE inclusion_package_id = $1 AND (company_id = $2 OR builder_id = $3) RETURNING inclusion_package_id",
      [id, companyId, builderId],
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Inclusion package not found or access denied.");
    }

    return successResponse(res, null, "Inclusion package deleted successfully.");
  } catch (error) {
    console.error("Error deleting inclusion package:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}
