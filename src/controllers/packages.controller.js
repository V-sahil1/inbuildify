const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      name,
      categoryItemIds: category_item_ids,
      amount,
      range,
      dwelling,
    } = req.body;
    const builderId = req.user.builder_id;

    const checkQuery = `
      SELECT category_item_id, description, cost 
      FROM category_items 
      WHERE builder_id = $1 AND status = 'ACTIVE' AND package_only = 'TRUE' AND category_item_id = ANY($2::uuid[])
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

    const rangeCheck = await client.query(
      `SELECT range_id, name FROM range WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false`,
      [range, builderId]
    );
    if (rangeCheck.rowCount === 0) {
      return errorResponse(res, 400, `Range '${range}' does not exist`);
    }

    const dwellingCheck = await client.query(
      `SELECT dwelling_type_id, name FROM dwelling_type WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false`,
      [dwelling, builderId]
    );
    if (dwellingCheck.rowCount === 0) {
      return errorResponse(
        res,
        400,
        `Dwelling type '${dwelling}' does not exist`
      );
    }

    const insertQuery = `
      INSERT INTO packages (name, builder_id, category_item_ids, amount, range_id, dwelling_type_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [
      name,
      builderId,
      category_item_ids,
      amount,
      rangeCheck.rows[0].range_id,
      dwellingCheck.rows[0].dwelling_type_id,
    ]);

    const items = checkResult.rows.map((row) => ({
      id: row.category_item_id,
      desc: row.description,
      price: row.cost || 0,
    }));

    const finalResult = {
      ...result.rows[0],
      range: rangeCheck.rows[0].name,
      dwelling: dwellingCheck.rows[0].name,
      category_items: items,
    };

    return successResponse(
      res,
      keysToCamelCase(finalResult),
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
             r.name AS range_name,
             dt.name AS dwelling_type_name,
             ARRAY_AGG(ci.description) AS category_item_descriptions,
             ARRAY_AGG(ci.short_description) AS category_item_short_desc
      FROM packages p
      LEFT JOIN category_items ci 
        ON ci.category_item_id = ANY(p.category_item_ids)
      LEFT JOIN range r ON p.range_id = r.range_id
      LEFT JOIN dwelling_type dt ON p.dwelling_type_id = dt.dwelling_type_id
      WHERE p.package_id = $1 AND p.builder_id = $2
      GROUP BY p.package_id, r.name, dt.name;
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
  const { range, dwelling_type } = req.query;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  let rangeId = null;
  let dwellingTypeId = null;

  if (range) {
    const rangeCheck = await client.query(
      `SELECT range_id, name FROM range WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false`,
      [range, builderId]
    );
    if (rangeCheck.rowCount === 0) {
      return errorResponse(res, 400, `Range '${range}' does not exist`);
    }
    rangeId = rangeCheck.rows[0].range_id;
  }

  if (dwelling_type) {
    const dwellingCheck = await client.query(
      `SELECT dwelling_type_id, name FROM dwelling_type WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false`,
      [dwelling_type, builderId]
    );
    if (dwellingCheck.rowCount === 0) {
      return errorResponse(
        res,
        400,
        `Dwelling type '${dwelling_type}' does not exist`
      );
    }
    dwellingTypeId = dwellingCheck.rows[0].dwelling_type_id;
  }

  try {
    let query = `
      SELECT p.*, 
             r.name AS range_name,
             dt.name AS dwelling_name,
             ARRAY_AGG(ci.description) AS category_item_descriptions,
             ARRAY_AGG(ci.category_item_id) AS category_item_ids,
             ARRAY_AGG(ci.cost) AS category_item_costs
      FROM packages p
      LEFT JOIN category_items ci 
        ON ci.category_item_id = ANY(p.category_item_ids)
      LEFT JOIN range r 
        ON p.range_id = r.range_id
      LEFT JOIN dwelling_type dt 
        ON p.dwelling_type_id = dt.dwelling_type_id
      WHERE p.builder_id = $1
    `;

    const values = [builderId];
    let paramIndex = 2;

    if (rangeId) {
      query += ` AND p.range_id = $${paramIndex}`;
      values.push(rangeId);
      paramIndex++;
    }

    if (dwellingTypeId) {
      query += ` AND p.dwelling_type_id = $${paramIndex}`;
      values.push(dwellingTypeId);
      paramIndex++;
    }

    query += `
      GROUP BY p.package_id, r.name, dt.name
      ORDER BY p.created_at DESC;
    `;

    const result = await client.query(query, values);

    const finalResult = result.rows.map((row) => {
      const ids = row.category_item_ids || [];
      const descriptions = row.category_item_descriptions || [];
      const prices = row.category_item_costs || [];

      const items = [];
      for (let i = 0; i < Math.max(ids.length, descriptions.length, prices.length); i++) {
        if (ids[i] && descriptions[i]) {
          items.push({
            id: ids[i],
            desc: descriptions[i],
            price: prices[i] || 0
          });
        }
      }

      delete row.category_item_ids;
      delete row.category_item_descriptions;
      delete row.category_item_costs;

      return {
        ...row,
        category_items: items,
        range: row.range_name || null,
        dwelling: row.dwelling_name || null,
      };
    });

    return successResponse(
      res,
      keysToCamelCase(finalResult),
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

    let rangeId = null;
    let dwellingTypeId = null;

    if (range) {
      const rangeRes = await client.query(
        `SELECT range_id 
         FROM range 
         WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false`,
        [range, builderId]
      );
      rangeId = rangeRes.rows[0]?.range_id;
      if (!rangeId) {
        return errorResponse(res, 400, "Invalid range provided.");
      }
    }

    if (dwelling_type) {
      const typeRes = await client.query(
        `SELECT dwelling_type_id 
         FROM dwelling_type 
         WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false`,
        [dwelling_type, builderId]
      );
      dwellingTypeId = typeRes.rows[0]?.dwelling_type_id;
      if (!dwellingTypeId) {
        return errorResponse(res, 400, "Invalid dwelling type provided.");
      }
    }

    const conditions = [
      `ci.builder_id = $1`,
      `ci.status = 'ACTIVE'`,
      `ci.package_only = TRUE`,
    ];

    const params = [builderId];
    let paramIndex = params.length + 1;

    if (rangeId) {
      conditions.push(`ci.range_id = $${paramIndex++}`);
      params.push(rangeId);
    }
    if (dwellingTypeId) {
      conditions.push(`ci.dwelling_type_id = $${paramIndex++}`);
      params.push(dwellingTypeId);
    }

    const query = `
      SELECT ci.*
      FROM category_items ci
      WHERE ${conditions.join(" AND ")}
      ORDER BY ci.sort_order ASC;
    `;

    const result = await client.query(query, params);

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

exports.updatePackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_id } = req.params;
    const {
      name,
      categoryItemIds: category_item_ids,
      amount,
      range,
      dwelling,
    } = req.body;
    const builderId = req.user.builder_id;

    const packageCheck = await client.query(
      `SELECT * FROM packages WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );
    if (packageCheck.rowCount === 0) {
      return errorResponse(res, 404, "Package not found");
    }

    if (category_item_ids && category_item_ids.length > 0) {
      const checkQuery = `
        SELECT category_item_id, description, cost
        FROM category_items
        WHERE builder_id = $1
          AND status = 'ACTIVE'
          AND package_only = 'TRUE'
          AND category_item_id = ANY($2::uuid[])
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
    }

    if (name) {
      const nameCheck = await client.query(
        `SELECT 1 FROM packages WHERE name = $1 AND builder_id = $2 AND package_id != $3`,
        [name, builderId, package_id]
      );
      if (nameCheck.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "Package name already exists for this builder"
        );
      }
    }

    let rangeId = null;
    let rangeName = null;
    if (range) {
      const rangeQuery = `
        SELECT range_id, name
        FROM range
        WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL)
        LIMIT 1;
      `;
      const rangeResult = await client.query(rangeQuery, [range, builderId]);
      if (rangeResult.rowCount > 0) {
        rangeId = rangeResult.rows[0].range_id;
        rangeName = rangeResult.rows[0].name;
      } else {
        return errorResponse(res, 400, `Range '${range}' does not exist`);
      }
    }

    let dwellingId = null;
    let dwellingName = null;
    if (dwelling) {
      const dwellingQuery = `
        SELECT dwelling_type_id, name
        FROM dwelling_type
        WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL)
        LIMIT 1;
      `;
      const dwellingResult = await client.query(dwellingQuery, [
        dwelling,
        builderId,
      ]);
      if (dwellingResult.rowCount > 0) {
        dwellingId = dwellingResult.rows[0].dwelling_type_id;
        dwellingName = dwellingResult.rows[0].name;
      } else {
        return errorResponse(
          res,
          400,
          `Dwelling type '${dwelling}' does not exist`
        );
      }
    }

    const updateQuery = `
      UPDATE packages
      SET name = COALESCE($1, name),
          category_item_ids = COALESCE($2, category_item_ids),
          amount = COALESCE($3, amount),
          range_id = COALESCE($4, range_id),
          dwelling_type_id = COALESCE($5, dwelling_type_id),
          updated_at = NOW()
      WHERE package_id = $6 AND builder_id = $7
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      name || null,
      category_item_ids || null,
      amount || null,
      rangeId || null,
      dwellingId || null,
      package_id,
      builderId,
    ]);

    const updatedPackage = result.rows[0];

    let categoryItems = [];
    if (
      updatedPackage.category_item_ids &&
      updatedPackage.category_item_ids.length > 0
    ) {
      const categoryItemsQuery = `
        SELECT category_item_id, description, cost
        FROM category_items
        WHERE category_item_id = ANY($1::uuid[])
      `;
      const categoryItemsResult = await client.query(categoryItemsQuery, [
        updatedPackage.category_item_ids,
      ]);
      categoryItems = categoryItemsResult.rows.map((row) => ({
        id: row.category_item_id,
        desc: row.description,
        price: row.cost || 0,
      }));
    }

    if (!rangeName && updatedPackage.range_id) {
      const rangeQuery = `SELECT range_id, name FROM range WHERE range_id = $1`;
      const rangeResult = await client.query(rangeQuery, [
        updatedPackage.range_id,
      ]);
      rangeId = rangeResult.rows.length > 0 ? rangeResult.rows[0].range_id : null;
      rangeName = rangeResult.rows.length > 0 ? rangeResult.rows[0].name : null;
    }

    if (!dwellingName && updatedPackage.dwelling_type_id) {
      const dwellingQuery = `SELECT dwelling_type_id, name FROM dwelling_type WHERE dwelling_type_id = $1`;
      const dwellingResult = await client.query(dwellingQuery, [
        updatedPackage.dwelling_type_id,
      ]);
      dwellingId = dwellingResult.rows.length > 0 ? dwellingResult.rows[0].dwelling_type_id : null;
      dwellingName =
        dwellingResult.rows.length > 0 ? dwellingResult.rows[0].name : null;
    }

    return successResponse(
      res,
      keysToCamelCase({
        packageId: updatedPackage.package_id,
        name: updatedPackage.name,
        category_items: categoryItems,
        amount: updatedPackage.amount,
        rangeId,
        dwellingId,
        range: rangeName,
        dwelling: dwellingName,
        createdAt: updatedPackage.created_at,
        updatedAt: updatedPackage.updated_at,
      }),
      "Package updated successfully."
    );
  } catch (err) {
    console.error("Error updating package:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deletePackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_id } = req.params;
    const builderId = req.user.builder_id;

    const check = await client.query(
      `SELECT 1 FROM packages WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );
    if (check.rowCount === 0) {
      return errorResponse(res, 404, "Package not found");
    }

    await client.query(
      `DELETE FROM packages WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );

    return successResponse(res, null, "Package deleted successfully.");
  } catch (err) {
    console.error("Error deleting package:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
