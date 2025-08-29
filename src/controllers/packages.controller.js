const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { name, category_item_ids, amount } = req.body;
    const builderId = req.user.builder_id;

    const checkQuery = `
      SELECT category_item_id, description 
      FROM category_items 
      WHERE builder_id = $1 AND status = 'ACTIVE' AND category_item_id = ANY($2::uuid[])
    `;
    const checkResult = await client.query(checkQuery, [
      builderId,
      category_item_ids,
    ]);

    if (checkResult.rowCount !== category_item_ids.length) {
      return errorResponse(
        res,
        400,
        "One or more category_item_ids are invalid or not ACTIVE"
      );
    }

    const nameCheck = await client.query(
      `SELECT 1 FROM packages WHERE name = $1 AND builder_id = $2`,
      [name, builderId]
    );
    if (nameCheck.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Package name already exists for this builder"
      );
    }

    const insertQuery = `
      INSERT INTO packages (name, builder_id, category_item_ids, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [
      name,
      builderId,
      category_item_ids,
      amount,
    ]);

    return successResponse(
      res,
      keysToCamelCase({...result.rows[0], category_item_descriptions: checkResult.rows.map(row => row.description)}),
      "Package created successfully."
    );
  } catch (err) {
    console.error("Error creating package:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPackageById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_id } = req.params;
    const builderId = req.user.builder_id;

    const query = `
      SELECT p.*, 
             ARRAY_AGG(ci.description) AS category_item_descriptions,
             ARRAY_AGG(ci.short_description) AS category_item_short_desc
      FROM packages p
      LEFT JOIN category_items ci 
        ON ci.category_item_id = ANY(p.category_item_ids)
      WHERE p.package_id = $1 AND p.builder_id = $2
      GROUP BY p.package_id;
    `;

    const result = await client.query(query, [package_id, builderId]);
    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Package not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Package fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching package:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllPackages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;

    const query = `
      SELECT p.*, 
             ARRAY_AGG(ci.description) AS category_item_descriptions
      FROM packages p
      LEFT JOIN category_items ci 
        ON ci.category_item_id = ANY(p.category_item_ids)
      WHERE p.builder_id = $1
      GROUP BY p.package_id
      ORDER BY p.created_at DESC;
    `;

    const result = await client.query(query, [builderId]);
    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Packages fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching packages:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPackageItems = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { range, dwelling_type } = req.query;

    const rangeCheck = await client.query(
      `SELECT range_id, name FROM range WHERE name = $1`,
      [range]
    );
    if (rangeCheck.rowCount === 0) {
      return errorResponse(res, 400, `Range '${range}' does not exist`);
    }
    const rangeId = rangeCheck.rows[0].range_id;

    const dwellingCheck = await client.query(
      `SELECT dwelling_type_id, name FROM dwelling_type WHERE name = $1`,
      [dwelling_type]
    );
    if (dwellingCheck.rowCount === 0) {
      return errorResponse(
        res,
        400,
        `Dwelling type '${dwelling_type}' does not exist`
      );
    }
    const dwellingTypeId = dwellingCheck.rows[0].dwelling_type_id;

    const query = `
        SELECT ci.*,
               r.name AS range_name,
               d.name AS dwelling_type_name
        FROM category_items ci
        INNER JOIN range r ON r.range_id = ci.range_id
        INNER JOIN dwelling_type d ON d.dwelling_type_id = ci.dwelling_type_id
        WHERE ci.builder_id = $1
          AND ci.status = 'ACTIVE'
          AND ci.range_id = $2
          AND ci.dwelling_type_id = $3
        ORDER BY ci.sort_order ASC;
      `;

    const result = await client.query(query, [
      builderId,
      rangeId,
      dwellingTypeId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Package items fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching package items:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
