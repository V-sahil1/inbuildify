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

    return successResponse(res, keysToCamelCase(itemResult.rows[0]), "Category item created successfully with conditions.");
  } catch (err) {
    await client.query(`ROLLBACK`);
    console.error("Error creating category item:", err);
    return errorResponse(res, 500, "Internal Server Error");
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

    let { status } = req.query;

    if (status) {
      status = status.toUpperCase();
      if (status !== "ACTIVE" && status !== "INACTIVE") {
        return errorResponse(res, 400, "Status must be either ACTIVE or INACTIVE");
      }
    } else {
      status = "ACTIVE";
    }

    const query = `
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
      GROUP BY ci.category_item_id, r.name, d.name
      ORDER BY ci.sort_order;
    `;

    const result = await client.query(query, [category_id, builderId, status]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Category items fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching category items:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
