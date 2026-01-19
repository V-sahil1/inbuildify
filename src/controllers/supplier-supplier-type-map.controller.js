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
        "supplier_id and supplier_type_id are required.",
      );
    }

    await client.query("BEGIN");

    const supplierRes = await client.query(
      `SELECT supplier_id, builder_id 
       FROM supplier 
       WHERE supplier_id = $1`,
      [supplier_id],
    );

    if (
      supplierRes.rowCount === 0 ||
      supplierRes.rows[0].builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Invalid supplier: does not belong to this builder.",
      );
    }

    if (supplier_id) {
      const supplierCheck = await client.query(
        `SELECT supplier_id 
     FROM supplier 
     WHERE builder_id = $1 
       AND supplier_id = $2 
       AND status = true`,
        [builderId, supplier_id],
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
      [supplier_type_id],
    );

    if (typeRes.rowCount === 0 || typeRes.rows[0].builder_id !== builderId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Invalid supplier type: does not belong to this builder.",
      );
    }

    if (supplier_type_id) {
      const supplierTypeCheck = await client.query(
        `SELECT supplier_type_id 
     FROM supplier_type
     WHERE builder_id = $1 
       AND supplier_type_id = $2 
       AND is_active = true`,
        [builderId, supplier_type_id],
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
      [supplier_id, supplier_type_id],
    );

    if (mappingExists.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This supplier is already mapped to this supplier type.",
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
      "Supplier type mapping created successfully.",
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
    const { assign_to_new_and_existing_checklist } = req.body;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    await client.query("BEGIN");

    // Check if the mapping exists and belongs to this builder
    const checkMap = await client.query(
      `SELECT sstm.*, s.builder_id as supplier_builder_id, st.builder_id as type_builder_id
       FROM supplier_supplier_type_map sstm
       JOIN supplier s ON sstm.supplier_id = s.supplier_id
       JOIN supplier_type st ON sstm.supplier_type_id = st.supplier_type_id
       WHERE sstm.id = $1 LIMIT 1`,
      [id],
    );

    if (checkMap.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Mapping not found.");
    }

    const mapData = checkMap.rows[0];
    if (
      mapData.supplier_builder_id !== builderId ||
      mapData.type_builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Mapping does not belong to this builder.",
      );
    }

    // Set all other records with same supplier_type_id to is_recommended = false
    await client.query(
      `UPDATE supplier_supplier_type_map 
       SET is_recommended = false 
       WHERE supplier_type_id = $1 AND id <> $2`,
      [mapData.supplier_type_id, id],
    );

    // Update the current record
    const updateQuery = `
      UPDATE supplier_supplier_type_map
      SET is_recommended = true, 
          assign_to_new_and_existing_checklist = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      assign_to_new_and_existing_checklist !== undefined
        ? assign_to_new_and_existing_checklist
        : mapData.assign_to_new_and_existing_checklist,
      id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier type mapping updated successfully.",
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
      [id],
    );

    if (getMap.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Record not found");
    }

    const { supplier_id, supplier_type_id } = getMap.rows[0];

    const supplierCheck = await client.query(
      `SELECT supplier_id FROM supplier 
       WHERE supplier_id = $1 AND builder_id = $2`,
      [supplier_id, builderId],
    );

    if (supplierCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot delete other builder supplier records",
      );
    }

    const supplierTypeCheck = await client.query(
      `SELECT supplier_type_id FROM supplier_type 
       WHERE supplier_type_id = $1 AND builder_id = $2`,
      [supplier_type_id, builderId],
    );

    if (supplierTypeCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot delete other builder supplier type records",
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

exports.createSupplierTypeConstructionChecklistMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { supplier_type_id, construction_checklist_id } = req.body;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    if (!supplier_type_id || !construction_checklist_id) {
      return errorResponse(
        res,
        400,
        "supplier_type_id and construction_checklist_id are required.",
      );
    }

    await client.query("BEGIN");

    // Check if supplier type belongs to this builder
    const supplierTypeRes = await client.query(
      `SELECT supplier_type_id, builder_id 
       FROM supplier_type 
       WHERE supplier_type_id = $1`,
      [supplier_type_id],
    );

    if (
      supplierTypeRes.rowCount === 0 ||
      supplierTypeRes.rows[0].builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Supplier type does not belong to this builder.",
      );
    }

    // Check if mapping already exists
    const existingMapping = await client.query(
      `SELECT id FROM supplier_type_construction_checklist_map 
       WHERE supplier_type_id = $1 AND construction_checklist_id = $2 LIMIT 1`,
      [supplier_type_id, construction_checklist_id],
    );

    if (existingMapping.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This supplier type is already mapped to this construction checklist.",
      );
    }

    const insertQuery = `
      INSERT INTO supplier_type_construction_checklist_map (supplier_type_id, construction_checklist_id)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      supplier_type_id,
      construction_checklist_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier type construction checklist mapping created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      "Error creating supplier type construction checklist mapping:",
      error,
    );
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSupplierTypeConstructionChecklistMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 400, "ID is required");
    }

    await client.query("BEGIN");

    // Get mapping to check ownership
    const getMap = await client.query(
      `SELECT stcm.supplier_type_id, st.builder_id
       FROM supplier_type_construction_checklist_map stcm
       JOIN supplier_type st ON stcm.supplier_type_id = st.supplier_type_id
       WHERE stcm.id = $1`,
      [id],
    );

    if (getMap.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Mapping not found");
    }

    const { supplier_type_id, builder_id } = getMap.rows[0];

    if (builder_id !== builderId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot delete other builder supplier type construction checklist mappings",
      );
    }

    await client.query(
      `DELETE FROM supplier_type_construction_checklist_map WHERE id = $1`,
      [id],
    );

    await client.query("COMMIT");

    return successResponse(res, 200, "Mapping deleted successfully", null);
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.getAllSupplierTypeConstructionChecklistMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { page = 1, limit = 25, supplier_type_id } = req.query;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let conditions = [];
    let values = [];
    let index = 1;

    // Add builder scope condition
    conditions.push(`st.builder_id = $${index++}`);
    values.push(builderId);

    if (supplier_type_id) {
      conditions.push(`stcm.supplier_type_id = $${index++}`);
      values.push(supplier_type_id);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const dataQuery = `
      SELECT stcm.*, st.name as supplier_type_name
      FROM supplier_type_construction_checklist_map stcm
      JOIN supplier_type st ON stcm.supplier_type_id = st.supplier_type_id
      ${whereClause}
      ORDER BY stcm.created_at DESC
      LIMIT $${index++} OFFSET $${index++};
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM supplier_type_construction_checklist_map stcm
      JOIN supplier_type st ON stcm.supplier_type_id = st.supplier_type_id
      ${whereClause};
    `;

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuery, [...values, limitNum, offset]),
      client.query(countQuery, values),
    ]);

    const rows = keysToCamelCase(dataResult.rows);
    const total = parseInt(countResult.rows[0].total, 10);

    const pagination = {
      total,
      currentPage: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };

    return successResponse(
      res,
      { checklistMap: rows, pagination },
      "Supplier type construction checklist maps fetched successfully.",
    );
  } catch (error) {
    console.error(
      "Error fetching supplier type construction checklist maps:",
      error,
    );
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
