import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createMasterPriceListCategoryItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const {
      master_price_list_category_id,
      name,
      sku,
      short_description,
      full_description,
      item_type,
      cost = 0,
      cost_type,
      cost_option,
      currency = "AUD",
      uom,
      sort_order = 0,
      is_standard = false,
      is_upgrade = false,
      extra = {},
    } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 400, "Builder ID and Company ID are required.");
    }

    if (!master_price_list_category_id) {
      return errorResponse(
        res,
        400,
        "master_price_list_category_id is required.",
      );
    }

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Item name is required.");
    }

    if (!cost_type || !["include", "fixed", "variable"].includes(cost_type)) {
      return errorResponse(
        res,
        400,
        "Invalid cost_type. Must be one of: include, fixed, variable.",
      );
    }

    if (!cost_option || !["none", "tba", "tbc"].includes(cost_option)) {
      return errorResponse(
        res,
        400,
        "Invalid cost_option. Must be one of: none, tba, tbc.",
      );
    }

    await client.query("BEGIN");

    const categoryCheck = await client.query(
      `
      SELECT master_price_list_category_id 
      FROM master_price_list_categories 
      WHERE master_price_list_category_id = $1 
        AND builder_id = $2 
        AND company_id = $3
        AND is_deleted = FALSE
      `,
      [master_price_list_category_id, builderId, companyId],
    );

    if (categoryCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Master price list category not found or not accessible.",
      );
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM master_price_list_categories_item
      WHERE builder_id = $1
        AND company_id = $2
        AND master_price_list_category_id = $3
        AND LOWER(name) = LOWER($4)
      `,
      [builderId, companyId, master_price_list_category_id, name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Item name already exists in this category.",
      );
    }

    let finalSortOrder = sort_order;
    if (!sort_order || sort_order <= 0) {
      const orderRes = await client.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
        FROM master_price_list_categories_item
        WHERE builder_id = $1 AND company_id = $2 AND master_price_list_category_id = $3
        `,
        [builderId, companyId, master_price_list_category_id],
      );
      finalSortOrder = orderRes.rows[0].next_order;
    }

    const insertQuery = `
      INSERT INTO master_price_list_categories_item (
        master_price_list_category_id,
        company_id,
        builder_id,
        name,
        sku,
        short_description,
        full_description,
        item_type,
        cost,
        cost_type,
        cost_option,
        currency,
        uom,
        sort_order,
        is_standard,
        is_upgrade,
        extra,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18
      )
      RETURNING *;
    `;

    const values = [
      master_price_list_category_id,
      companyId,
      builderId,
      name.trim(),
      sku || null,
      short_description || null,
      full_description || null,
      item_type || null,
      cost,
      cost_type,
      cost_option,
      currency,
      uom || null,
      finalSortOrder,
      is_standard,
      is_upgrade,
      extra,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Master Price List Category Item created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating master price list category item:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getMasterPriceListCategoryItemsByCategoryId(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { categoryId } = req.params;
    const { item_type } = req.query;
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!categoryId) {
      return errorResponse(res, 400, "Category ID is required.");
    }

    const categoryCheck = await client.query(
      `
      SELECT master_price_list_category_id
      FROM master_price_list_categories
    WHERE master_price_list_category_id = $1
        AND builder_id = $2
        
        AND company_id = $3
      `,
      [categoryId, builderId, companyId],
    );

    if (categoryCheck.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Master price list category not found or does not belong to this builder.",
      );
    }

    let query = `
      SELECT 
        *
      FROM master_price_list_categories_item mpci
      WHERE mpci.master_price_list_category_id = $1
        AND mpci.builder_id = $2
        AND mpci.company_id = $3
    `;

    const params = [categoryId, builderId, companyId];
    let paramIndex = 4;

    if (item_type) {
      query += ` AND LOWER(mpci.item_type) = LOWER($${paramIndex})`;
      params.push(item_type);
      paramIndex++;
    }

    query += " ORDER BY mpci.sort_order ASC, mpci.name ASC;";

    const result = await client.query(query, params);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Category items fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching category items:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err?.message || "Internal Server Error",
    );
  } finally {
    client.release();
  }
}

export async function updateMasterPriceListCategoryItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const updatedBy = req.user?.user_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { category_item_id } = req.params;

    if ("master_price_list_category_id" in req.body) {
      return errorResponse(
        res,
        400,
        "Updating master_price_list_category_id is not allowed.",
      );
    }

    const {
      name,
      sku,
      short_description,
      full_description,
      item_type,
      cost,
      cost_type,
      cost_option,
      currency,
      uom,
      sort_order,
      is_standard,
      is_upgrade,
      extra,
    } = req.body;

    await client.query("BEGIN");

    const itemRes = await client.query(
      `
      SELECT master_price_list_category_id, builder_id, company_id
      FROM master_price_list_categories_item
      WHERE master_price_list_categories_item_id = $1
        AND builder_id = $2
        AND company_id = $3
      `,
      [category_item_id, builderId, companyId],
    );

    if (itemRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Category item not found or not owned by this builder.",
      );
    }

    const { master_price_list_category_id } = itemRes.rows[0];

    if (name) {
      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM master_price_list_categories_item
        WHERE LOWER(name) = LOWER($1)
          AND master_price_list_category_id = $2
          AND builder_id = $3
          AND company_id = $4
          AND master_price_list_categories_item_id != $5
        `,
        [
          name,
          master_price_list_category_id,
          builderId,
          companyId,
          category_item_id,
        ],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Item name already exists in this category.",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    const addField = (column, value) => {
      if (value !== undefined) {
        if (column === "extra") {
          updateFields.push(`${column} = $${idx}::jsonb`);
          updateValues.push(JSON.stringify(value));
        } else {
          updateFields.push(`${column} = $${idx}`);
          updateValues.push(value);
        }
        idx++;
      }
    };

    addField("name", name);
    addField("sku", sku);
    addField("short_description", short_description);
    addField("full_description", full_description);
    addField("item_type", item_type);
    addField("cost", cost);
    addField("cost_type", cost_type);
    addField("cost_option", cost_option);
    addField("currency", currency);
    addField("uom", uom);
    addField("sort_order", sort_order);
    addField("is_standard", is_standard);
    addField("is_upgrade", is_upgrade);
    addField("extra", extra);
    addField("updated_by", updatedBy);
    addField("updated_at", new Date());

    let updatedItem = null;

    if (updateFields.length > 0) {
      const updateQuery = `
        UPDATE master_price_list_categories_item
        SET ${updateFields.join(", ")}
        WHERE master_price_list_categories_item_id = $${idx}
          AND builder_id = $${idx + 1}
          AND company_id = $${idx + 2}
        RETURNING *;
      `;
      updateValues.push(category_item_id, builderId, companyId);

      const updatedRes = await client.query(updateQuery, updateValues);
      updatedItem = updatedRes.rows[0];
    } else {
      const fetchRes = await client.query(
        `
        SELECT *
        FROM master_price_list_categories_item
        WHERE master_price_list_categories_item_id = $1
          AND builder_id = $2
          AND company_id = $3
        `,
        [category_item_id, builderId, companyId],
      );
      updatedItem = fetchRes.rows[0];
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updatedItem),
      "Category item updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating category item:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteMasterPriceListCategoryItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { category_item_id } = req.params;
    const deletedById = req.user?.user_id;

    await client.query("BEGIN");

    const itemRes = await client.query(
      `
      SELECT * 
      FROM master_price_list_categories_item 
      WHERE master_price_list_categories_item_id = $1 
      `,
      [category_item_id],
    );

    if (itemRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Category item not found or already deleted.",
      );
    }

    const item = itemRes.rows[0];

    await client.query(
      `
     DELETE FROM master_price_list_categories_item WHERE master_price_list_categories_item_id = $1
      `,
      [category_item_id],
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(item),
      "Category item deleted successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting category item:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err?.message || "Internal Server Error",
    );
  } finally {
    client.release();
  }
}
