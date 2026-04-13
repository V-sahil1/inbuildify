import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

// Ownership check helper
const verifyVersionOwnership = async (client, quotationVersionId, companyId, builderId) => {
  const result = await client.query(
    `SELECT qv.quotation_version_id, qv.is_approve, qv.dwelling_type_id, qv.range_id
     FROM quotation_version qv
     JOIN quotation q ON qv.quotation_id = q.quotation_id
     JOIN leads l ON q.leads_id = l.leads_id
     WHERE qv.quotation_version_id = $1 AND (
       (l.company_id = $2 AND $2 IS NOT NULL)
       OR (l.builder_id = $3 AND $3 IS NOT NULL)
     ) LIMIT 1`,
    [quotationVersionId, companyId, builderId],
  );
  return result.rowCount > 0 ? result.rows[0] : null;
};

// Helper to enrich range and dwelling type metadata
const getEnrichedMetadata = async (client, rangeIds, dwellingTypeIds) => {
  const result = {
    range: [],
    dwelling_type: []
  };

  if (rangeIds && rangeIds.length > 0) {
    const rangeRes = await client.query(
      `SELECT range_id as id, name FROM range WHERE range_id = ANY($1)`,
      [rangeIds]
    );
    result.range = rangeRes.rows;
  }

  if (dwellingTypeIds && dwellingTypeIds.length > 0) {
    const dwellingRes = await client.query(
      `SELECT dwelling_type_id as id, name FROM dwelling_type WHERE dwelling_type_id = ANY($1)`,
      [dwellingTypeIds]
    );
    result.dwelling_type = dwellingRes.rows;
  }

  return result;
};

// Helper to verify ownership of multiple IDs in range/dwelling_type tables
const verifyMetadataOwnership = async (client, tableName, idArray, companyId, builderId) => {
  if (!idArray || idArray.length === 0) return true;
  const idColumn = `${tableName}_id`;
  const result = await client.query(
    `SELECT COUNT(*) FROM ${tableName} 
     WHERE ${idColumn} = ANY($1) AND (
       (company_id = $2 AND $2 IS NOT NULL)
       OR (builder_id = $3 AND $3 IS NOT NULL)
     )`,
    [idArray, companyId, builderId]
  );
  return parseInt(result.rows[0].count) === idArray.length;
};

// Add individual item snapshot
export async function addQuotationItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id, price_list_item_id, quantity, note } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
    if (!version) {
      return errorResponse(res, 404, "Quotation version not found or unauthorized");
    }

    if (version.is_approve) {
      return errorResponse(res, 400, "Cannot modify an approved quotation version");
    }

    // Fetch master item details
    const itemResult = await client.query(
      `SELECT pli.*, pl.name as price_list_name
       FROM price_list_item pli
       JOIN price_list pl ON pli.price_list_id = pl.price_list_id
       WHERE pli.price_list_item_id = $1 AND pli.status = 'active' AND (
         (pli.company_id = $2 AND $2 IS NOT NULL)
         OR (pli.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [price_list_item_id, companyId, builderId],
    );

    if (itemResult.rowCount === 0) {
      return errorResponse(res, 404, "Price list item not found or inactive");
    }

    const masterItem = itemResult.rows[0];

    // Check for duplicate
    const duplicateCheck = await client.query(
      `SELECT quotation_version_item_id FROM quotation_version_items 
       WHERE quotation_version_id = $1 AND price_list_item_id = $2 AND package_id IS NULL LIMIT 1`,
      [quotation_version_id, price_list_item_id]
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 409, "This item is already added to the quotation version");
    }

    const qty = parseFloat(quantity) || 1;
    const cost = parseFloat(masterItem.cost || 0);
    const totalPrice = parseFloat((qty * cost).toFixed(2));

    const result = await client.query(
      `INSERT INTO quotation_version_items (
        quotation_version_id, price_list_id, price_list_name, price_list_item_id,
        price_list_item_description, price_list_item_short_description,
        price_list_item_cost_type, price_list_item_cost_type_text,
        price_list_item_cost_option, price_list_item_cost, price_list_item_builder_cost,
        price_list_item_sort_order, price_list_item_uom, price_list_item_status,
        price_list_item_include_by_default, price_list_item_allow_remove_from_quotation,
        price_list_item_show_in_hl_package, price_list_item_package_only,
        price_list_item_range_id, price_list_item_dwelling_type_id,
        price_list_item_created_at, price_list_item_updated_at,
        quantity, note, total_price,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        quotation_version_id, masterItem.price_list_id, masterItem.price_list_name, masterItem.price_list_item_id,
        masterItem.item_description, masterItem.short_description,
        masterItem.cost_type, masterItem.cost_type_text,
        masterItem.cost_option, masterItem.cost, masterItem.builder_cost,
        masterItem.sort_order, masterItem.uom, masterItem.status,
        masterItem.include_by_default, masterItem.allow_remove_from_quotation,
        masterItem.show_in_hl_package, masterItem.show_only_in_package,
        masterItem.range_id, masterItem.dwelling_type_id,
        masterItem.created_at, masterItem.updated_at,
        qty, note || null, totalPrice
      ]
    );

    return successResponse(res, keysToCamelCase(result.rows[0]), 201, "Item added to quotation version successfully");
  } catch (error) {
    console.error("Add quotation item error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Add package snapshot
export async function addQuotationPackage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id, package_id } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
    if (!version) {
      return errorResponse(res, 404, "Quotation version not found or unauthorized");
    }

    if (version.is_approve) {
      return errorResponse(res, 400, "Cannot modify an approved quotation version");
    }

    // Fetch package details
    const packageResult = await client.query(
      `SELECT * FROM package WHERE package_id = $1 AND status = true AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [package_id, companyId, builderId]
    );

    if (packageResult.rowCount === 0) {
      return errorResponse(res, 404, "Package not found or inactive");
    }

    const pkg = packageResult.rows[0];
  
    // Check if any package already exists in this quotation version
    const packageCheck = await client.query(
      `SELECT quotation_version_item_id FROM quotation_version_items 
       WHERE quotation_version_id = $1 AND package_id IS NOT NULL LIMIT 1`,
      [quotation_version_id]
    );

    if (packageCheck.rowCount > 0) {
      return errorResponse(res, 409, "A package has already been added to this quotation version. Please remove the existing package before adding a new one.");
    }
  
    // Fetch all items for this package
    const itemsResult = await client.query(
      `SELECT pli.*, pl.name as price_list_name
       FROM package_pricelist_item_map ppim
       JOIN price_list_item pli ON ppim.price_list_item_id = pli.price_list_item_id
       JOIN price_list pl ON pli.price_list_id = pl.price_list_id
       WHERE ppim.package_id = $1 AND pli.status = 'active'`,
      [package_id]
    );

    await client.query("BEGIN");

    const insertedItems = [];

    // 1. Always insert a "Package Summary" row that carries the total price
    const summaryResult = await client.query(
      `INSERT INTO quotation_version_items (
        quotation_version_id, package_id, package_name, package_cost, package_builder_cost,
        quantity, total_price,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        quotation_version_id, pkg.package_id, pkg.name, pkg.cost, pkg.builder_cost,
        1, pkg.cost || 0
      ]
    );
    insertedItems.push(summaryResult.rows[0]);

    // 2. If there are items, insert them with total_price = 0 (marking them as "Included")
    if (itemsResult.rowCount > 0) {
      for (const masterItem of itemsResult.rows) {
        const qty = 1; // Default quantity for package items

        const result = await client.query(
          `INSERT INTO quotation_version_items (
            quotation_version_id, price_list_id, price_list_name, price_list_item_id,
            price_list_item_description, price_list_item_short_description,
            price_list_item_cost_type, price_list_item_cost_type_text,
            price_list_item_cost_option, price_list_item_cost, price_list_item_builder_cost,
            price_list_item_sort_order, price_list_item_uom, price_list_item_status,
            price_list_item_include_by_default, price_list_item_allow_remove_from_quotation,
            price_list_item_show_in_hl_package, price_list_item_package_only,
            price_list_item_range_id, price_list_item_dwelling_type_id,
            price_list_item_created_at, price_list_item_updated_at,
            package_id, package_name, package_cost, package_builder_cost,
            quantity, total_price,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *`,
          [
            quotation_version_id, masterItem.price_list_id, masterItem.price_list_name, masterItem.price_list_item_id,
            masterItem.item_description, masterItem.short_description,
            masterItem.cost_type, masterItem.cost_type_text,
            masterItem.cost_option, masterItem.cost, masterItem.builder_cost,
            masterItem.sort_order, masterItem.uom, masterItem.status,
            masterItem.include_by_default, masterItem.allow_remove_from_quotation,
            masterItem.show_in_hl_package, masterItem.show_only_in_package,
            masterItem.range_id, masterItem.dwelling_type_id,
            masterItem.created_at, masterItem.updated_at,
            pkg.package_id, pkg.name, pkg.cost, pkg.builder_cost,
            qty, 0 // Items are included, so total_price is 0
          ]
        );
        insertedItems.push(result.rows[0]);
      }
    }

    await client.query("COMMIT");

    return successResponse(res, insertedItems.map(item => keysToCamelCase(item)), 201, "Package items added to quotation version successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add quotation package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Get all items for a version
export async function getQuotationVersionItems(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id } = req.params;
    const { range_id, dwelling_type_id } = req.query;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
    if (!version) {
      return errorResponse(res, 404, "Quotation version not found or unauthorized");
    }

    const values = [quotation_version_id];
    let queryFilters = "";

    if (range_id) {
      values.push(range_id);
      queryFilters += ` AND ($${values.length} = ANY(qvi.price_list_item_range_id) OR qvi.price_list_item_range_id = '{}'::uuid[])`;
    }

    if (dwelling_type_id) {
      values.push(dwelling_type_id);
      queryFilters += ` AND ($${values.length} = ANY(qvi.price_list_item_dwelling_type_id) OR qvi.price_list_item_dwelling_type_id = '{}'::uuid[])`;
    }

    const query = `
      WITH package_counts AS (
        SELECT 
          package_id, 
          COUNT(*) as saved_count
        FROM quotation_version_items
        WHERE quotation_version_id = $1 AND package_id IS NOT NULL
        GROUP BY package_id
      ),
      master_package_counts AS (
        SELECT 
          ppim.package_id,
          COUNT(*) as current_count
        FROM package_pricelist_item_map ppim
        JOIN price_list_item pli2 ON ppim.price_list_item_id = pli2.price_list_item_id
        WHERE pli2.status = 'active'
        GROUP BY ppim.package_id
      )
      SELECT 
        qvi.*,
        pli.cost AS current_price_list_item_cost,
        p.cost AS current_package_cost,
        mpc.current_count::int AS current_package_item_count,
        pc.saved_count::int AS saved_package_item_count,
        CASE 
          WHEN qvi.price_list_item_id IS NOT NULL AND pli.cost IS NOT NULL 
               AND qvi.price_list_item_cost::numeric != pli.cost::numeric THEN true 
          ELSE false 
        END AS is_price_list_item_cost_mismatch,
        CASE 
          WHEN qvi.package_id IS NOT NULL AND (
            (p.cost IS NOT NULL AND qvi.package_cost::numeric != p.cost::numeric)
            OR
            (COALESCE(pc.saved_count, 0) != COALESCE(mpc.current_count, 0))
          ) THEN true 
          ELSE false 
        END AS is_package_cost_mismatch
      FROM quotation_version_items qvi
      LEFT JOIN price_list_item pli ON qvi.price_list_item_id = pli.price_list_item_id
      LEFT JOIN package p ON qvi.package_id = p.package_id
      LEFT JOIN package_counts pc ON qvi.package_id = pc.package_id
      LEFT JOIN master_package_counts mpc ON qvi.package_id = mpc.package_id
      WHERE qvi.quotation_version_id = $1
      ${queryFilters}
      ORDER BY qvi.created_at ASC
    `;

    const result = await client.query(query, values);
    const items = result.rows;

    const formattedItems = items.map(row => {
      const item = keysToCamelCase(row);
      
      // Remove temporary calculation fields before sending the response
      delete item.currentPriceListItemCost;
      delete item.currentPackageCost;
      delete item.currentPackageItemCount;
      delete item.savedPackageItemCount;

      return {
        ...item,
        isPriceListItemCostMismatch: row.is_price_list_item_cost_mismatch,
        isPackageCostMismatch: row.is_package_cost_mismatch
      };
    });

    return successResponse(res, formattedItems, 200, "Quotation version items fetched successfully");
  } catch (error) {
    console.error("Get quotation version items error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Update item snapshot
export async function updateQuotationVersionItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { quantity, note, price_list_item_description } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const itemCheck = await client.query(
      `SELECT qvi.*, qv.is_approve 
       FROM quotation_version_items qvi
       JOIN quotation_version qv ON qvi.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE qvi.quotation_version_item_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (itemCheck.rowCount === 0) {
      return errorResponse(res, 404, "Quotation version item not found or unauthorized");
    }

    if (itemCheck.rows[0].is_approve) {
      return errorResponse(res, 400, "Cannot modify an approved quotation version");
    }

    const item = itemCheck.rows[0];
    const qty = quantity !== undefined ? parseFloat(quantity) : parseFloat(item.quantity);
    const cost = parseFloat(item.price_list_item_cost || 0);
    const totalPrice = parseFloat((qty * cost).toFixed(2));

    const result = await client.query(
      `UPDATE quotation_version_items 
       SET quantity = $1, 
           note = $2, 
           total_price = $3, 
           price_list_item_description = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE quotation_version_item_id = $5
       RETURNING *`,
      [
        qty,
        note !== undefined ? note : item.note,
        totalPrice,
        price_list_item_description !== undefined ? price_list_item_description : item.price_list_item_description,
        id
      ]
    );

    return successResponse(res, keysToCamelCase(result.rows[0]), 200, "Quotation version item updated successfully");
  } catch (error) {
    console.error("Update quotation version item error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Delete item
export async function deleteQuotationVersionItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const itemCheck = await client.query(
      `SELECT qvi.*, qv.is_approve 
       FROM quotation_version_items qvi
       JOIN quotation_version qv ON qvi.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE qvi.quotation_version_item_id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (itemCheck.rowCount === 0) {
      return errorResponse(res, 404, "Quotation version item not found or unauthorized");
    }

    if (itemCheck.rows[0].is_approve) {
      return errorResponse(res, 400, "Cannot modify an approved quotation version");
    }

    if (itemCheck.rows[0].package_id) {
      return errorResponse(res, 400, "Cannot delete an item that belongs to a package. Please remove the entire package instead.");
    }

    await client.query(`DELETE FROM quotation_version_items WHERE quotation_version_item_id = $1`, [id]);

    return successResponse(res, null, 200, "Quotation version item deleted successfully");
  } catch (error) {
    console.error("Delete quotation version item error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Delete package
export async function deletePackageFromVersion(req, res) {
    const pool = getPool();
    const client = await pool.connect();
  
    try {
      const { quotation_version_id, package_id } = req.params;
      const builderId = req.user?.builder_id;
      const companyId = req.user?.company_id;
  
      const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
      if (!version) {
        return errorResponse(res, 404, "Quotation version not found or unauthorized");
      }
  
      if (version.is_approve) {
        return errorResponse(res, 400, "Cannot modify an approved quotation version");
      }
  
      const result = await client.query(
        `DELETE FROM quotation_version_items 
         WHERE quotation_version_id = $1 AND package_id = $2`,
        [quotation_version_id, package_id]
      );
  
      if (result.rowCount === 0) {
        return errorResponse(res, 404, "No items found for this package in the quotation version");
      }
  
      return successResponse(res, null, 200, "Package items removed from quotation version successfully");
    } catch (error) {
      console.error("Delete package from version error:", error);
      return errorResponse(res, 500, "Internal server error");
    } finally {
      client.release();
    }
  }

export async function addExtraQuotationItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id } = req.params;
    const { 
      extra_type, 
      price_list_id, 
      price_list_item_description, 
      price_list_item_cost_type, 
      price_list_item_builder_cost, 
      price_list_item_uom, 
      price_list_item_cost, 
      quantity, 
      note,
      price_list_item_range_id,
      price_list_item_dwelling_type_id,
      price_list_item_cost_type_text
    } = req.body;
    
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
    if (!version) {
      return errorResponse(res, 404, "Quotation version not found or unauthorized");
    }

    if (version.is_approve) {
      return errorResponse(res, 400, "Cannot modify an approved quotation version");
    }

    // Verify ownership of range and dwelling types if provided
    const rangesValid = await verifyMetadataOwnership(client, "range", price_list_item_range_id, companyId, builderId);
    if (!rangesValid) {
      return errorResponse(res, 403, "One or more Range IDs are invalid or unauthorized");
    }

    const dwellingTypesValid = await verifyMetadataOwnership(client, "dwelling_type", price_list_item_dwelling_type_id, companyId, builderId);
    if (!dwellingTypesValid) {
      return errorResponse(res, 403, "One or more Dwelling Type IDs are invalid or unauthorized");
    }

    // Fetch price list details for the name
    const priceListResult = await client.query(
      `SELECT name FROM price_list 
       WHERE price_list_id = $1 AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [price_list_id, companyId, builderId]
    );

    if (priceListResult.rowCount === 0) {
      return errorResponse(res, 404, "Price list not found or unauthorized");
    }
    
    const priceListName = priceListResult.rows[0].name;

    // Calculate totals
    let qty = parseFloat(quantity) || 1;
    let unitCost = parseFloat(price_list_item_cost || 0);
    let bCost = parseFloat(price_list_item_builder_cost || 0);
    let totalPrice = 0;
    let pCostType = price_list_item_cost_type || null;
    let pUom = price_list_item_uom || null;

    if (pCostType === "Included") {
      qty = 1;
      unitCost = 0;
      bCost = 0;
      totalPrice = 0;
    }

    if (extra_type === "item") {
      totalPrice = parseFloat((qty * unitCost).toFixed(2));
    } else if (extra_type === "discount") {
      qty = 1;
      unitCost = -Math.abs(unitCost);
      totalPrice = unitCost;
      pCostType = null;
      pUom = null;
      bCost = null;
    } else if (extra_type === "complimentry") {
      totalPrice = 0; // Complimentary items show cost but add $0 to total
    }

    const result = await client.query(
      `INSERT INTO quotation_version_items (
        quotation_version_id, price_list_id, price_list_name,
        price_list_item_description,
        price_list_item_cost_type, price_list_item_cost, price_list_item_builder_cost,
        price_list_item_uom,
        extra_type, extra_item,
        quantity, note, total_price,
        price_list_item_range_id, price_list_item_dwelling_type_id,
        price_list_item_cost_type_text,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        quotation_version_id, price_list_id, priceListName,
        price_list_item_description,
        pCostType, unitCost, bCost,
        pUom,
        extra_type, true,
        qty, note || null, totalPrice,
        price_list_item_range_id || '{}',
        price_list_item_dwelling_type_id || '{}',
        price_list_item_cost_type_text || null
      ]
    );

    const enrichedMetadata = await getEnrichedMetadata(client, result.rows[0].price_list_item_range_id, result.rows[0].price_list_item_dwelling_type_id);

    return successResponse(res, keysToCamelCase({ ...result.rows[0], ...enrichedMetadata }), 201, "Extra quotation item added successfully");
  } catch (error) {
    console.error("Add extra quotation item error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateExtraQuotationItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { 
      price_list_item_description, 
      price_list_item_cost_type, 
      price_list_item_builder_cost, 
      price_list_item_uom, 
      price_list_item_cost, 
      quantity, 
      note,
      price_list_item_cost_type_text,
      price_list_item_range_id,
      price_list_item_dwelling_type_id
    } = req.body;
    
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    // Fetch existing item and check ownership/approval status
    const itemCheck = await client.query(
      `SELECT qvi.*, qv.is_approve 
       FROM quotation_version_items qvi
       JOIN quotation_version qv ON qvi.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE qvi.quotation_version_item_id = $1 AND qvi.extra_item = true AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (itemCheck.rowCount === 0) {
      return errorResponse(res, 404, "Extra quotation version item not found or unauthorized");
    }

    const item = itemCheck.rows[0];
    if (item.is_approve) {
      return errorResponse(res, 400, "Cannot modify an approved quotation version");
    }

    // Verify ownership of range and dwelling types if provided as part of the update
    if (price_list_item_range_id !== undefined) {
      const rangesValid = await verifyMetadataOwnership(client, "range", price_list_item_range_id, companyId, builderId);
      if (!rangesValid) {
        return errorResponse(res, 403, "One or more Range IDs are invalid or unauthorized");
      }
    }

    if (price_list_item_dwelling_type_id !== undefined) {
      const dwellingTypesValid = await verifyMetadataOwnership(client, "dwelling_type", price_list_item_dwelling_type_id, companyId, builderId);
      if (!dwellingTypesValid) {
        return errorResponse(res, 403, "One or more Dwelling Type IDs are invalid or unauthorized");
      }
    }

    const { extra_type, quotation_version_id, price_list_id } = item;

    // Calculate totals based on extra_type
    let qty = parseFloat(quantity !== undefined ? quantity : item.quantity);
    let unitCost = parseFloat(price_list_item_cost !== undefined ? price_list_item_cost : item.price_list_item_cost);
    let bCost = parseFloat(price_list_item_builder_cost !== undefined ? price_list_item_builder_cost : item.price_list_item_builder_cost);
    let totalPrice = parseFloat(item.total_price);
    let pCostType = price_list_item_cost_type !== undefined ? price_list_item_cost_type : item.price_list_item_cost_type;
    let pUom = price_list_item_uom !== undefined ? price_list_item_uom : item.price_list_item_uom;

    if (pCostType === "Included") {
      qty = 1;
      unitCost = 0;
      bCost = 0;
      totalPrice = 0;
    }

    if (extra_type === "item") {
      totalPrice = parseFloat((qty * unitCost).toFixed(2));
    } else if (extra_type === "discount") {
      qty = 1;
      unitCost = -Math.abs(unitCost);
      totalPrice = unitCost;
      pCostType = null;
      pUom = null;
      bCost = null;
    } else if (extra_type === "complimentry") {
      totalPrice = 0; // Complimentary items show cost but add $0 to total
    }

    const result = await client.query(
      `UPDATE quotation_version_items 
       SET price_list_item_description = $1,
           price_list_item_cost_type = $2,
           price_list_item_cost = $3,
           price_list_item_builder_cost = $4,
           price_list_item_uom = $5,
           quantity = $6,
           note = $7,
           total_price = $8,
           price_list_item_cost_type_text = $9,
           price_list_item_range_id = $10,
           price_list_item_dwelling_type_id = $11,
           updated_at = CURRENT_TIMESTAMP
       WHERE quotation_version_item_id = $12
       RETURNING *`,
      [
        price_list_item_description !== undefined ? price_list_item_description : item.price_list_item_description,
        pCostType,
        unitCost,
        bCost,
        pUom,
        qty,
        note !== undefined ? note : item.note,
        totalPrice,
        price_list_item_cost_type_text !== undefined ? price_list_item_cost_type_text : item.price_list_item_cost_type_text,
        price_list_item_range_id !== undefined ? price_list_item_range_id : item.price_list_item_range_id,
        price_list_item_dwelling_type_id !== undefined ? price_list_item_dwelling_type_id : item.price_list_item_dwelling_type_id,
        id
      ]
    );

    const enrichedMetadata = await getEnrichedMetadata(client, result.rows[0].price_list_item_range_id, result.rows[0].price_list_item_dwelling_type_id);

    return successResponse(res, keysToCamelCase({ ...result.rows[0], ...enrichedMetadata }), 200, "Extra quotation item updated successfully");
  } catch (error) {
    console.error("Update extra quotation item error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export default {
  addQuotationItem,
  addQuotationPackage,
  getQuotationVersionItems,
  updateQuotationVersionItem,
  deleteQuotationVersionItem,
  deletePackageFromVersion,
  addExtraQuotationItem,
  updateExtraQuotationItem
};
