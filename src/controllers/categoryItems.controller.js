const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createCategoryItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const {
      category_id,
      description,
      short_description,
      cost_type,
      cost,
      cost_type_text,
      cost_option,
      include_by_default,
      show_in_hl_package,
      package_only,
      uom,
      sort_order,
      range,
      dwelling,
      conditions,
      status,
    } = req.body;

    await client.query(`BEGIN`);

    const category = await client.query(`SELECT 1 FROM categories WHERE category_id = $1`, [category_id]);
    if (category.rows.length === 0) {
      await client.query(`ROLLBACK`);
      return errorResponse(res, 404, "Category not found.");
    }

    let rangeId = null;
    if (range) {
      const rangeRes = await client.query(`SELECT range_id FROM range WHERE name = $1`, [range]);
      if (rangeRes.rows.length === 0) {
        await client.query(`ROLLBACK`);
        return errorResponse(res, 404, `Range '${range}' not found.`);
      }
      rangeId = rangeRes.rows[0].range_id;
    }

    let dwellingId = null;
    if (dwelling) {
      const dwellingRes = await client.query(`SELECT dwelling_type_id FROM dwelling_type WHERE name = $1`, [dwelling]);
      if (dwellingRes.rows.length === 0) {
        await client.query(`ROLLBACK`);
        return errorResponse(res, 404, `Dwelling type '${dwelling}' not found.`);
      }
      dwellingId = dwellingRes.rows[0].dwelling_type_id;
    }

    const itemQuery = `
      INSERT INTO category_items (
        builder_id, category_id, description, short_description,
        cost_type, cost, cost_type_text, cost_option,
        include_by_default, show_in_hl_package, package_only,
        uom, sort_order, range_id, dwelling_type_id, status
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        $9,$10,$11,
        $12,$13,$14,$15,$16
      )
      RETURNING *;
    `;

    const itemValues = [
      builderId,
      category_id,
      description,
      short_description,
      cost_type,
      cost,
      cost_type_text,
      cost_option,
      include_by_default,
      show_in_hl_package,
      package_only,
      uom,
      sort_order,
      rangeId,
      dwellingId,
      status,
    ];

    const itemResult = await client.query(itemQuery, itemValues);
    const categoryItemId = itemResult.rows[0].category_item_id;

    if (conditions && conditions.length > 0) {
      const condNames = conditions.map(c => c.name);
    
      const condResult = await client.query(
        `SELECT condition_id, name FROM conditions WHERE name = ANY($1::text[])`,
        [condNames]
      );
    
      if (condResult.rows.length !== condNames.length) {
        const foundNames = condResult.rows.map(r => r.name);
        const missing = condNames.filter(c => !foundNames.includes(c));
        await client.query(`ROLLBACK`);
        return errorResponse(res, 400, `Missing conditions: ${missing.join(", ")}`);
      }
    
      const conditionMap = {};
      condResult.rows.forEach(r => { conditionMap[r.name] = r.condition_id; });
    
      const conditionIds = conditions.map(c => conditionMap[c.name]);
    
      const dupCheck = await client.query(
        `SELECT condition_id
         FROM category_items_condition
         WHERE builder_id = $1 AND category_item_id = $2 
         AND condition_id = ANY($3::uuid[])`,
        [builderId, categoryItemId, conditionIds]
      );
    
      if (dupCheck.rows.length > 0) {
        const dupIds = dupCheck.rows.map(r => r.condition_id);
        const dupNames = Object.entries(conditionMap)
          .filter(([name, id]) => dupIds.includes(id))
          .map(([name]) => name);
    
        await client.query(`ROLLBACK`);
        return errorResponse(res, 400, `Duplicate conditions found: ${dupNames.join(", ")}`);
      }
    
      const values = [];
      const params = [];
      let i = 1;
    
      for (const cond of conditions) {
        values.push(
          `($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`
        );
        params.push(
          builderId,
          categoryItemId,
          conditionMap[cond.name],
          cond.range_start,
          cond.range_end
        );
      }
    
      const insertQuery = `
        INSERT INTO category_items_condition
        (builder_id, category_item_id, condition_id, range_start, range_end)
        VALUES ${values.join(", ")}
      `;
    
      await client.query(insertQuery, params);
    }    

    await client.query(`COMMIT`);

    const item = {
      ...itemResult.rows[0],
      range_name: range,
      dwelling_type_name: dwelling,
    };
    return successResponse(res, keysToCamelCase(item), "Category item created successfully with conditions.");
  } catch (err) {
    await client.query(`ROLLBACK`);
    console.error("Error creating category item:", err);
    return errorResponse(res, err?.statusCode || 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getCategoryItemsByCategoryId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { category_id } = req.params;
    const builderId = req.user.builder_id;

    let { status, range, dwellingType } = req.query;

    if (status) {
      status = status.toUpperCase();
      if (status !== "ACTIVE" && status !== "INACTIVE") {
        return errorResponse(res, 400, "Status must be either ACTIVE or INACTIVE");
      }
    } else {
      status = "ACTIVE";
    }

    let rangeId = null;
    let dwellingTypeId = null;

    if (range) {
      const rangeResult = await client.query(
        `SELECT range_id FROM range WHERE name = $1`,
        [range]
      );
      if (rangeResult.rowCount === 0) {
        return errorResponse(res, 404, `Range '${range}' not found.`);
      }
      rangeId = rangeResult.rows[0].range_id;
    }

    if (dwellingType) {
      const dwellingResult = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type WHERE name = $1`,
        [dwellingType]
      );
      if (dwellingResult.rowCount === 0) {
        return errorResponse(res, 404, `Dwelling type '${dwellingType}' not found.`);
      }
      dwellingTypeId = dwellingResult.rows[0].dwelling_type_id;
    }

    let query = `
      SELECT 
        ci.category_item_id,
        ci.builder_id,
        ci.category_id,
        ci.description,
        ci.short_description,
        ci.cost_type,
        ci.cost,
        ci.cost_type_text,
        ci.cost_option,
        ci.include_by_default,
        ci.show_in_hl_package,
        ci.package_only,
        ci.uom,
        ci.sort_order,
        ci.status,
        ci.created_at,
        ci.updated_at,
        r.name AS range_name,
        d.name AS dwelling_type_name,
        COALESCE(
          json_agg(
            json_build_object(
              'condition_id', c.condition_id,
              'name', c.name,
              'range_start', cic.range_start,
              'range_end', cic.range_end
            )
          ) FILTER (WHERE c.condition_id IS NOT NULL), '[]'
        ) AS conditions
      FROM category_items ci
      LEFT JOIN range r ON ci.range_id = r.range_id
      LEFT JOIN dwelling_type d ON ci.dwelling_type_id = d.dwelling_type_id
      LEFT JOIN category_items_condition cic 
        ON ci.category_item_id = cic.category_item_id AND ci.builder_id = cic.builder_id
      LEFT JOIN conditions c 
        ON cic.condition_id = c.condition_id
      WHERE ci.category_id = $1 AND ci.builder_id = $2 AND ci.status = $3
    `;

    const params = [category_id, builderId, status];
    let paramIndex = 4;

    if (rangeId) {
      query += ` AND ci.range_id = $${paramIndex++}`;
      params.push(rangeId);
    }

    if (dwellingTypeId) {
      query += ` AND ci.dwelling_type_id = $${paramIndex++}`;
      params.push(dwellingTypeId);
    }

    query += `
      GROUP BY ci.category_item_id, r.name, d.name
      ORDER BY ci.created_at DESC;
    `;

    const result = await client.query(query, params);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Category items fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching category items:", err);
    return errorResponse(res, err?.statusCode || 400, err?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateCategoryItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { category_item_id } = req.params;

    if ("category_id" in req.body) {
      return errorResponse(res, 400, "Updating category_id is not allowed.");
    }

    const {
      description,
      short_description,
      cost_type,
      cost,
      cost_type_text,
      cost_option,
      include_by_default,
      show_in_hl_package,
      package_only,
      uom,
      sort_order,
      range,
      dwelling,
      status,
      conditions,
    } = req.body;

    await client.query("BEGIN");

    const itemRes = await client.query(
      `SELECT category_id FROM category_items WHERE category_item_id = $1 AND builder_id = $2`,
      [category_item_id, builderId]
    );
    if (itemRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Category item not found.");
    }

    let rangeId = null;
    if (range) {
      const rangeRes = await client.query(`SELECT range_id FROM range WHERE name = $1`, [range]);
      if (rangeRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, `Range '${range}' not found.`);
      }
      rangeId = rangeRes.rows[0].range_id;
    }

    let dwellingId = null;
    if (dwelling) {
      const dwRes = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type WHERE name = $1`,
        [dwelling]
      );
      if (dwRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, `Dwelling type '${dwelling}' not found.`);
      }
      dwellingId = dwRes.rows[0].dwelling_type_id;
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    const addField = (column, value) => {
      if (value !== undefined) {
        updateFields.push(`${column} = $${idx++}`);
        updateValues.push(value);
      }
    };

    addField("description", description);
    addField("short_description", short_description);
    addField("cost_type", cost_type);
    addField("cost", cost);
    addField("cost_type_text", cost_type_text);
    addField("cost_option", cost_option);
    addField("include_by_default", include_by_default);
    addField("show_in_hl_package", show_in_hl_package);
    addField("package_only", package_only);
    addField("uom", uom);
    addField("sort_order", sort_order);
    addField("range_id", rangeId);
    addField("dwelling_type_id", dwellingId);
    addField("status", status);
    addField("updated_at", new Date());

    let updatedItem = null;
    if (updateFields.length > 0) {
      const updateQuery = `
        UPDATE category_items
        SET ${updateFields.join(", ")}
        WHERE category_item_id = $${idx++} AND builder_id = $${idx++}
        RETURNING *;
      `;
      updateValues.push(category_item_id, builderId);

      const updatedRes = await client.query(updateQuery, updateValues);
      updatedItem = updatedRes.rows[0];
    } else {
      // If no fields to update, just fetch existing
      const fetchRes = await client.query(
        `SELECT * FROM category_items WHERE category_item_id = $1 AND builder_id = $2`,
        [category_item_id, builderId]
      );
      updatedItem = fetchRes.rows[0];
    }

    if (conditions) {
      await client.query(
        `DELETE FROM category_items_condition WHERE category_item_id = $1 AND builder_id = $2`,
        [category_item_id, builderId]
      );

      if (conditions.length > 0) {
        const condNames = conditions.map(c => c.name);

        const condRes = await client.query(
          `SELECT condition_id, name FROM conditions WHERE name = ANY($1::text[])`,
          [condNames]
        );

        if (condRes.rowCount !== condNames.length) {
          const found = condRes.rows.map(r => r.name);
          const missing = condNames.filter(c => !found.includes(c));
          await client.query("ROLLBACK");
          return errorResponse(res, 400, `Invalid conditions: ${missing.join(", ")}`);
        }

        const condMap = {};
        condRes.rows.forEach(r => { condMap[r.name] = r.condition_id; });

        const insertValues = [];
        const params = [];
        let p = 1;

        for (const cond of conditions) {
          insertValues.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
          params.push(builderId, category_item_id, condMap[cond.name], cond.range_start, cond.range_end);
        }

        await client.query(
          `INSERT INTO category_items_condition
           (builder_id, category_item_id, condition_id, range_start, range_end)
           VALUES ${insertValues.join(", ")}`,
          params
        );
      }
    }

    const condFinal = await client.query(
      `SELECT c.name, cic.range_start, cic.range_end
       FROM category_items_condition cic
       JOIN conditions c ON c.condition_id = cic.condition_id
       WHERE cic.category_item_id = $1 AND cic.builder_id = $2`,
      [category_item_id, builderId]
    );
    updatedItem.conditions = condFinal.rows;
    range ? updatedItem.range_name = range : updatedItem.range_name = null;
    dwelling ? updatedItem.dwelling_type_name = dwelling : updatedItem.dwelling_type_name = null;

    await client.query("COMMIT");

    return successResponse(res, keysToCamelCase(updatedItem), "Category item updated successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating category item:", err);
    return errorResponse(res, err?.statusCode || 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteCategoryItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { category_item_id } = req.params;

    await client.query("BEGIN");

    const itemRes = await client.query(
      `SELECT * FROM category_items WHERE category_item_id = $1 AND builder_id = $2`,
      [category_item_id, builderId]
    );

    if (itemRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Category item not found.");
    }

    const item = itemRes.rows[0];

    await client.query(
      `DELETE FROM category_items_condition WHERE category_item_id = $1 AND builder_id = $2`,
      [category_item_id, builderId]
    );

    await client.query(
      `DELETE FROM category_items WHERE category_item_id = $1 AND builder_id = $2`,
      [category_item_id, builderId]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(item),
      "Category item deleted successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting category item:", err);
    return errorResponse(res, err?.statusCode || 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
