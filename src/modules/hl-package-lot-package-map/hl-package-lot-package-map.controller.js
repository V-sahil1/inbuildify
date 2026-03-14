const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createHlPackageLotPackageMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id, lot_package_id } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    await client.query("BEGIN");

    const hlpCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package 
       WHERE house_land_package_id = $1 AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [house_land_package_id, companyId, builderId],
    );

    if (hlpCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "House land package not found or unauthorized access.");
    }

    const lpCheck = await client.query(
      `SELECT lp.lot_package_id FROM lot_package lp
       JOIN lot l ON lp.lot_id = l.lot_id
       WHERE lp.lot_package_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [lot_package_id, companyId, builderId],
    );

    if (lpCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lot package not found or unauthorized access.");
    }

    const mapCheck = await client.query(
      `SELECT id FROM h_l_package_lot_package_map 
       WHERE house_land_package_id = $1 AND lot_package_id = $2 LIMIT 1`,
      [house_land_package_id, lot_package_id],
    );

    if (mapCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "This mapping already exists."); 
    }

    const sql = `
      INSERT INTO h_l_package_lot_package_map (
        house_land_package_id,
        lot_package_id
      ) VALUES ($1, $2)
      RETURNING *
    `;

    const result = await client.query(sql, [house_land_package_id, lot_package_id]);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Mapping created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create HL Package Lot Package Map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getLotPackagesByHlPackageId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const hlpCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package 
       WHERE house_land_package_id = $1 AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [house_land_package_id, companyId, builderId],
    );

    if (hlpCheck.rowCount === 0) {
      return errorResponse(res, 404, "House land package not found or unauthorized access.");
    }

    const sql = `
      SELECT m.id as map_id, lp.*, l.lot_number 
      FROM h_l_package_lot_package_map m
      JOIN lot_package lp ON m.lot_package_id = lp.lot_package_id
      JOIN lot l ON lp.lot_id = l.lot_id
      WHERE m.house_land_package_id = $1
      ORDER BY m.created_at DESC
    `;

    const result = await client.query(sql, [house_land_package_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Linked lot packages retrieved successfully",
    );
  } catch (error) {
    console.error("Get Lot Packages by HL Package ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteHlPackageLotPackageMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    await client.query("BEGIN");

    const checkSql = `
      SELECT m.id FROM h_l_package_lot_package_map m
      JOIN house_land_package hlp ON m.house_land_package_id = hlp.house_land_package_id
      WHERE m.id = $1 AND (
        (hlp.company_id = $2 AND $2 IS NOT NULL)
        OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1
    `;
    const checkResult = await client.query(checkSql, [id, companyId, builderId]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return successResponse(res, null, "Mapping not found or unauthorized access.");
    }

    await client.query("DELETE FROM h_l_package_lot_package_map WHERE id = $1", [id]);
    await client.query("COMMIT");

    return successResponse(res, null, "Mapping deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete HL Package Lot Package Map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllHlPackageLotPackageMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { page = 1, limit = 25 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM h_l_package_lot_package_map m
      JOIN house_land_package hlp ON m.house_land_package_id = hlp.house_land_package_id
      WHERE (hlp.company_id = $1 AND $1 IS NOT NULL)
      OR (hlp.builder_id = $2 AND $2 IS NOT NULL)
    `;
    const countResult = await client.query(countQuery, [companyId, builderId]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    const sql = `
      SELECT m.*, hlp.title as hlp_title, lp.package_name, l.lot_number
      FROM h_l_package_lot_package_map m
      JOIN house_land_package hlp ON m.house_land_package_id = hlp.house_land_package_id
      JOIN lot_package lp ON m.lot_package_id = lp.lot_package_id
      JOIN lot l ON lp.lot_id = l.lot_id
      WHERE (hlp.company_id = $1 AND $1 IS NOT NULL)
      OR (hlp.builder_id = $2 AND $2 IS NOT NULL)
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await client.query(sql, [companyId, builderId, limitNum, offset]);

    return successResponse(res, {
      mappings: keysToCamelCase(result.rows),
      pagination: {
        totalRecords: total,
        currentPage: pageNum,
        totalPages: totalPages,
        limit: limitNum,
      },
    }, "All mappings retrieved successfully");
  } catch (error) {
    console.error("Get all HL Package Lot Package Maps error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
