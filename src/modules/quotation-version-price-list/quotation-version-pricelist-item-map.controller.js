import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

// Ownership check helper - returns version row or null
const verifyVersionOwnership = async (client, quotationVersionId, companyId, builderId) => {
  const result = await client.query(
    `SELECT qv.quotation_version_id, qv.location_id, qv.dwelling_type_id, qv.is_approve
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

// Create pricelist item map
export async function createPricelistItemMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id, price_list_item_id, quantity, note } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    // Validate quotation version ownership
    const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
    if (!version) {
      return errorResponse(res, 404, "Quotation version not found or does not belong to your organization");
    }

    if (version.is_approve === true) {
      return errorResponse(res, 400, "Cannot modify pricelist items of an approved quotation version");
    }

    // Check that location_id and dwelling_type_id are set on the version
    if (!version.location_id || !version.dwelling_type_id) {
      return errorResponse(res, 400, "Quotation version must have both location and dwelling type selected before adding pricelist items");
    }

    // Validate price list item exists, is active, and belongs to user's org
    const itemCheck = await client.query(
      `SELECT price_list_item_id, item_description, short_description, cost, cost_type, uom FROM price_list_item WHERE price_list_item_id = $1 AND status = 'active' AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [price_list_item_id, companyId, builderId],
    );

    if (itemCheck.rowCount === 0) {
      return errorResponse(res, 404, "Price list item not found, inactive, or does not belong to your organization");
    }

    if (itemCheck.rows[0].cost_type === "Included" && quantity !== undefined && quantity !== null) {
      return errorResponse(res, 400, "Quantity cannot be specified for items with cost type 'Included'");
    }

    // Check for duplicate mapping
    const duplicateCheck = await client.query(
      `SELECT id FROM quotation_version_pricelist_item_map
       WHERE quotation_version_id = $1 AND price_list_item_id = $2 LIMIT 1`,
      [quotation_version_id, price_list_item_id],
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 409, "This price list item is already mapped to the quotation version");
    }

    // Calculate total_price = quantity * cost
    const itemCost = parseFloat(itemCheck.rows[0].cost || 0);
    const qty = parseFloat(quantity) || 1;
    const totalPrice = parseFloat((qty * itemCost).toFixed(2));

    const result = await client.query(
      `INSERT INTO quotation_version_pricelist_item_map
       (quotation_version_id, price_list_item_id, quantity, note, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [quotation_version_id, price_list_item_id, qty, note || null, totalPrice],
    );

    // Format response immediately using explicitly ordered object
    const createdRow = result.rows[0];
    const itemCheckRow = itemCheck.rows[0];
    
    const responseData = {
      id: createdRow.id,
      quotationVersionId: createdRow.quotation_version_id,
      priceListItemId: createdRow.price_list_item_id,
      itemDescription: itemCheckRow.item_description,
      shortDescription: itemCheckRow.short_description,
      itemCost: itemCost,
      costType: itemCheckRow.cost_type,
      uom: itemCheckRow.uom,
      quantity: createdRow.quantity,
      totalPrice: createdRow.total_price,
      note: createdRow.note,
      createdAt: createdRow.created_at,
      updatedAt: createdRow.updated_at
    };

    return successResponse(res, responseData, 201, "Pricelist item mapped successfully");
  } catch (error) {
    console.error("Create pricelist item map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Get all pricelist item maps by quotation version id
export async function getPricelistItemsByVersionId(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { quotation_version_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const version = await verifyVersionOwnership(client, quotation_version_id, companyId, builderId);
    if (!version) {
      return errorResponse(res, 404, "Quotation version not found or does not belong to your organization");
    }

    const result = await client.query(
      `SELECT 
         m.id, 
         m.quotation_version_id, 
         m.price_list_item_id, 
         pli.item_description, 
         pli.short_description, 
         pli.cost as item_cost, 
         pli.cost_type, 
         pli.uom,
         m.quantity, 
         m.total_price, 
         m.note, 
         m.created_at, 
         m.updated_at
       FROM quotation_version_pricelist_item_map m
       LEFT JOIN price_list_item pli ON m.price_list_item_id = pli.price_list_item_id
       WHERE m.quotation_version_id = $1
       ORDER BY m.created_at ASC`,
      [quotation_version_id],
    );

    return successResponse(
      res,
      result.rows.map(row => keysToCamelCase(row)),
      "Pricelist item maps fetched successfully",
    );
  } catch (error) {
    console.error("Get pricelist item maps error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Update pricelist item map (quantity, note)
export async function updatePricelistItemMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { quantity, note } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    // Check ownership and get existing data
    const checkResult = await client.query(
      `SELECT m.*, pli.item_description, pli.short_description, pli.cost as item_cost, pli.cost_type, pli.uom, qv.location_id, qv.dwelling_type_id, qv.is_approve
       FROM quotation_version_pricelist_item_map m
       JOIN price_list_item pli ON m.price_list_item_id = pli.price_list_item_id
       JOIN quotation_version qv ON m.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE m.id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Pricelist item map not found or does not belong to your organization");
    }

    if (checkResult.rows[0].is_approve === true) {
      return errorResponse(res, 400, "Cannot modify pricelist items of an approved quotation version");
    }

    // Check that location_id and dwelling_type_id are still set
    if (!checkResult.rows[0].location_id || !checkResult.rows[0].dwelling_type_id) {
      return errorResponse(res, 400, "Quotation version must have both location and dwelling type selected before updating pricelist items");
    }

    if (checkResult.rows[0].cost_type === "Included" && quantity !== undefined && quantity !== null) {
      return errorResponse(res, 400, "Quantity cannot be updated for items with cost type 'Included'");
    }

    const existing = checkResult.rows[0];
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const finalQuantity = quantity !== undefined ? parseFloat(quantity) : parseFloat(existing.quantity);

    if (quantity !== undefined) {
      updateFields.push(`quantity = $${paramIndex++}`);
      values.push(finalQuantity);
    }

    if (note !== undefined) {
      updateFields.push(`note = $${paramIndex++}`);
      values.push(note);
    }

    // Recalculate total_price if quantity changed
    const itemCost = parseFloat(existing.item_cost || 0);
    const newTotalPrice = parseFloat((finalQuantity * itemCost).toFixed(2));
    updateFields.push(`total_price = $${paramIndex++}`);
    values.push(newTotalPrice);

    if (updateFields.length === 1) {
      // Only total_price was added, no user fields provided
      return errorResponse(res, 400, "No fields provided for update");
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const result = await client.query(
      `UPDATE quotation_version_pricelist_item_map
       SET ${updateFields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values,
    );

    // Format response immediately using explicitly ordered object
    const updatedRow = result.rows[0];
    const existingRow = existing; // from the join earlier
    
    const responseData = {
      id: updatedRow.id,
      quotationVersionId: updatedRow.quotation_version_id,
      priceListItemId: updatedRow.price_list_item_id,
      itemDescription: existingRow.item_description,
      shortDescription: existingRow.short_description,
      itemCost: itemCost,
      costType: existingRow.cost_type,
      uom: existingRow.uom,
      quantity: updatedRow.quantity,
      totalPrice: updatedRow.total_price,
      note: updatedRow.note,
      createdAt: updatedRow.created_at,
      updatedAt: updatedRow.updated_at
    };

    return successResponse(res, responseData, "Pricelist item map updated successfully");
  } catch (error) {
    console.error("Update pricelist item map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// Delete pricelist item map
export async function deletePricelistItemMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const checkResult = await client.query(
      `SELECT m.id, qv.is_approve
       FROM quotation_version_pricelist_item_map m
       JOIN quotation_version qv ON m.quotation_version_id = qv.quotation_version_id
       JOIN quotation q ON qv.quotation_id = q.quotation_id
       JOIN leads l ON q.leads_id = l.leads_id
       WHERE m.id = $1 AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Pricelist item map not found or does not belong to your organization");
    }

    if (checkResult.rows[0].is_approve === true) {
      return errorResponse(res, 400, "Cannot modify pricelist items of an approved quotation version");
    }

    await client.query(
      "DELETE FROM quotation_version_pricelist_item_map WHERE id = $1",
      [id],
    );

    return successResponse(res, null, "Pricelist item map deleted successfully");
  } catch (error) {
    console.error("Delete pricelist item map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

