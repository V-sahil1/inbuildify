const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createMaintenanceArea = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.users_id;

    const { name } = req.body;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const checkQuery = `
      SELECT maintenance_area_id
      FROM maintenance_area
      WHERE name = $1 AND (builder_id = $2 OR company_id = $3)
    `;
    const checkResult = await client.query(checkQuery, [
      name,
      builderId,
      companyId,
    ]);
    if (checkResult.rowCount > 0) {
      return errorResponse(res, 400, "Maintenance area name already exists.");
    }

    const insertQuery = `
      INSERT INTO maintenance_area
        (company_id, builder_id, name, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING *;
    `;
    const insertResult = await client.query(insertQuery, [
      companyId,
      builderId,
      name,
      createdBy,
    ]);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Maintenance area created successfully."
    );
  } catch (error) {
    console.error("Error creating maintenance area:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getAllMaintenanceAreas = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM maintenance_area
      WHERE builder_id = $1 OR company_id = $2
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limit);

    const dataQuery = `
      SELECT *
      FROM maintenance_area
      WHERE builder_id = $1 OR company_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      companyId,
      limit,
      offset,
    ]);

    return successResponse(
      res,
      {
        maintenanceArea: dataResult.rows,
        pagination: {
          totalRecords,
          currentPage: page,
          totalPages,
          limit,
        },
      },
      "Maintenance areas fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching maintenance areas:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.deleteMaintenanceArea = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { maintenance_area_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!maintenance_area_id) {
      return errorResponse(res, 400, "Maintenance area ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const ownershipQuery = `
      SELECT maintenance_area_id
      FROM maintenance_area
      WHERE maintenance_area_id = $1 AND (builder_id = $2 OR company_id = $3)
    `;
    const ownershipResult = await client.query(ownershipQuery, [
      maintenance_area_id,
      builderId,
      companyId,
    ]);

    if (ownershipResult.rowCount === 0) {
      return errorResponse(
        res,
        403,
        "You are not authorized to delete this maintenance area."
      );
    }

    const deleteQuery = `
      DELETE FROM maintenance_area
      WHERE maintenance_area_id = $1
      RETURNING *;
    `;
    const deleteResult = await client.query(deleteQuery, [maintenance_area_id]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Maintenance area not found.");
    }

    return successResponse(res, null, "Maintenance area deleted successfully.");
  } catch (error) {
    console.error("Error deleting maintenance area:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.updateMaintenanceArea = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { maintenance_area_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const updatedBy = req.user?.users_id;

    if (!maintenance_area_id) {
      return errorResponse(res, 400, "Maintenance area ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        400,
        "Invalid user context. Missing builder or company ID."
      );
    }

    const { name } = req.body;

    const ownershipQuery = `
      SELECT maintenance_area_id
      FROM maintenance_area
      WHERE maintenance_area_id = $1 AND (builder_id = $2 OR company_id = $3)
    `;
    const ownershipResult = await client.query(ownershipQuery, [
      maintenance_area_id,
      builderId,
      companyId,
    ]);

    if (ownershipResult.rowCount === 0) {
      return errorResponse(
        res,
        403,
        "You are not authorized to update this maintenance area."
      );
    }

    if (name) {
      const uniqueQuery = `
        SELECT maintenance_area_id
        FROM maintenance_area
        WHERE name = $1 AND (builder_id = $2 OR company_id = $3)
          AND maintenance_area_id != $4
      `;
      const uniqueResult = await client.query(uniqueQuery, [
        name,
        builderId,
        companyId,
        maintenance_area_id,
      ]);

      if (uniqueResult.rowCount > 0) {
        return errorResponse(res, 400, "Maintenance area name already exists.");
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined) {
      fields.push(`name = $${i++}`);
      values.push(name);
    }

    if (!fields.length) {
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(updatedBy);
    fields.push(`updated_at = NOW()`);

    values.push(maintenance_area_id);

    const updateQuery = `
      UPDATE maintenance_area
      SET ${fields.join(", ")}
      WHERE maintenance_area_id = $${i}
      RETURNING *;
    `;
    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Maintenance area not found.");
    }

    return successResponse(
      res,
      updateResult.rows[0],
      "Maintenance area updated successfully."
    );
  } catch (error) {
    console.error("Error updating maintenance area:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};
