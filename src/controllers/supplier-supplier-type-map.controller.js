const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createSupplierTypeMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { supplier_id, supplier_type_id } = req.body;

    if (!supplier_id || !supplier_type_id) {
      return errorResponse(
        res,
        400,
        "supplier_id and supplier_type_id are required."
      );
    }

    await client.query("BEGIN");

    const supplierRes = await client.query(
      `SELECT supplier_id, builder_id 
       FROM supplier 
       WHERE supplier_id = $1`,
      [supplier_id]
    );

    if (
      supplierRes.rowCount === 0 ||
      supplierRes.rows[0].builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Invalid supplier: does not belong to this builder."
      );
    }

    if (supplier_id) {
      const supplierCheck = await client.query(
        `SELECT supplier_id 
     FROM supplier 
     WHERE builder_id = $1 
       AND supplier_id = $2 
       AND status = true`,
        [builderId, supplier_id]
      );

      if (supplierCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "supplier id is inactive.");
      }
    }

    const typeRes = await client.query(
      `SELECT supplier_type_id, builder_id 
       FROM supplier_type 
       WHERE supplier_type_id = $1`,
      [supplier_type_id]
    );

    if (typeRes.rowCount === 0 || typeRes.rows[0].builder_id !== builderId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Invalid supplier type: does not belong to this builder."
      );
    }

    if (supplier_type_id) {
      const supplierTypeCheck = await client.query(
        `SELECT supplier_type_id 
     FROM supplier_type
     WHERE builder_id = $1 
       AND supplier_type_id = $2 
       AND is_active = true`,
        [builderId, supplier_type_id]
      );

      if (supplierTypeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "supplier type id is inactive.");
      }
    }

    const mappingExists = await client.query(
      `SELECT id 
       FROM supplier_supplier_type_map
       WHERE supplier_id = $1 AND supplier_type_id = $2
       LIMIT 1`,
      [supplier_id, supplier_type_id]
    );

    if (mappingExists.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This supplier is already mapped to this supplier type."
      );
    }

    const insertQuery = `
      INSERT INTO supplier_supplier_type_map (supplier_id, supplier_type_id)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      supplier_id,
      supplier_type_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier type mapping created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating supplier type mapping:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllSupplierTypeMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT *
      FROM supplier_supplier_type_map
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const { rows } = await client.query(dataQuery, [limit, offset]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM supplier_supplier_type_map
      
    `;
    const countResult = await client.query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    return successResponse(res, {
      supplierTypeMap: rows,
      total_records: totalRecords,
      current_page: page,
      total_pages: totalPages,
      limit,
    });
  } catch (error) {
    console.error("Error fetching supplier type maps:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSupplierTypeMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;
    const { supplier_id, supplier_type_id } = req.body;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    if (!supplier_id || !supplier_type_id) {
      return errorResponse(
        res,
        400,
        "supplier_id and supplier_type_id are required."
      );
    }

    await client.query("BEGIN");

    const checkMap = await client.query(
      `SELECT supplier_id, supplier_type_id FROM supplier_supplier_type_map WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (checkMap.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Mapping not found.");
    }

    const checkSupplier = await client.query(
      `SELECT builder_id FROM supplier WHERE supplier_id = $1 LIMIT 1`,
      [supplier_id]
    );
    if (
      checkSupplier.rowCount === 0 ||
      checkSupplier.rows[0].builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Supplier does not belong to this builder."
      );
    }

    const checkType = await client.query(
      `SELECT builder_id FROM supplier_type WHERE supplier_type_id = $1 LIMIT 1`,
      [supplier_type_id]
    );
    if (
      checkType.rowCount === 0 ||
      checkType.rows[0].builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Supplier type does not belong to this builder."
      );
    }

    const checkExist = await client.query(
      `SELECT id FROM supplier_supplier_type_map WHERE supplier_id = $1 AND supplier_type_id = $2 AND id <> $3 LIMIT 1`,
      [supplier_id, supplier_type_id, id]
    );
    if (checkExist.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This supplier is already mapped to this supplier type."
      );
    }

    const updateQuery = `
      UPDATE supplier_supplier_type_map
      SET supplier_id = $1, supplier_type_id = $2
      WHERE id = $3
      RETURNING *;
    `;
    const result = await client.query(updateQuery, [
      supplier_id,
      supplier_type_id,
      id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier type mapping updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating supplier type mapping:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSupplierSupplierTypeMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 400, "id is required");
    }

    await client.query("BEGIN");

    const getMap = await client.query(
      `SELECT supplier_id, supplier_type_id 
       FROM supplier_supplier_type_map 
       WHERE id = $1`,
      [id]
    );

    if (getMap.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Record not found");
    }

    const { supplier_id, supplier_type_id } = getMap.rows[0];

    const supplierCheck = await client.query(
      `SELECT supplier_id FROM supplier 
       WHERE supplier_id = $1 AND builder_id = $2`,
      [supplier_id, builderId]
    );

    if (supplierCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot delete other builder supplier records"
      );
    }

    const supplierTypeCheck = await client.query(
      `SELECT supplier_type_id FROM supplier_type 
       WHERE supplier_type_id = $1 AND builder_id = $2`,
      [supplier_type_id, builderId]
    );

    if (supplierTypeCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot delete other builder supplier type records"
      );
    }

    await client.query(`DELETE FROM supplier_supplier_type_map WHERE id = $1`, [
      id,
    ]);

    await client.query("COMMIT");

    return successResponse(res, 200, "Record deleted successfully", null);
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};
