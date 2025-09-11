const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { name, categoryItemIds: category_item_ids, amount } = req.body;
    const builderId = req.user.builder_id;

    const checkQuery = `
      SELECT category_item_id, description 
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
      keysToCamelCase({
        ...result.rows[0],
        category_item_descriptions: checkResult.rows.map(
          (row) => row.description
        ),
      }),
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
             ARRAY_AGG(ci.description) AS category_item_descriptions
      FROM packages p
      LEFT JOIN category_items ci 
        ON ci.category_item_id = ANY(p.category_item_ids)
      WHERE p.builder_id = $1
    `;

    const values = [builderId];
    let paramIndex = 2;

    if (rangeId) {
      query += ` AND ci.range_id = $${paramIndex}`;
      values.push(rangeId);
      paramIndex++;
    }

    if (dwellingTypeId) {
      query += ` AND ci.dwelling_type_id = $${paramIndex}`;
      values.push(dwellingTypeId);
      paramIndex++;
    }

    query += `
      GROUP BY p.package_id
      ORDER BY p.created_at DESC;
    `;

    const result = await client.query(query, values);

    const finalResult = result.rows.map((row) => {
      const descriptions = row.category_item_descriptions || [];
      const ids = row.category_item_ids || [];

      const validPairs = [];

      for (let i = 0; i < Math.max(ids.length, descriptions.length); i++) {
        const desc = descriptions[i];
        const id = ids[i];

        if (id !== null && id !== undefined && desc !== null && desc !== undefined) {
          validPairs.push({ id, desc });
        }
      }

      const validIds = validPairs.map(pair => pair.id);
      const validDescriptions = validPairs.map(pair => pair.desc);
      return {
        ...row,
        category_item_descriptions: validDescriptions,
        category_item_ids: validIds,
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
      `ci.package_only = TRUE`
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
    const { name, categoryItemIds: category_item_ids, amount } = req.body;
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
        SELECT category_item_id, description
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

    const updateQuery = `
      UPDATE packages
      SET name = COALESCE($1, name),
          category_item_ids = COALESCE($2, category_item_ids),
          amount = COALESCE($3, amount),
          updated_at = NOW()
      WHERE package_id = $4 AND builder_id = $5
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      name || null,
      category_item_ids || null,
      amount || null,
      package_id,
      builderId,
    ]);

    const categoryItemsQuery = `
      SELECT description
      FROM category_items
      WHERE category_item_id = ANY($1::uuid[])
    `;

    const categoryItemsResult = await client.query(categoryItemsQuery, [
      category_item_ids,
    ]);

    return successResponse(
      res,
      keysToCamelCase({
        ...result.rows[0],
        category_item_descriptions: categoryItemsResult.rows.map(
          (row) => row.description
        ),
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
