const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPriceListItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const {
      price_list_id,
      item_description,
      short_description,
      cost_type,
      cost_type_text,
      cost_option,
      cost,
      builder_cost,
      sort_order,
      uom,
      status,
      include_by_default,
      allow_remove_from_quotation,
      show_in_hl_package,
      show_only_in_package,
      range_id,
      dwelling_type_id,
      conditions,
    } = req.body;

    await client.query("BEGIN");

    const checkPriceList = await client.query(
      `SELECT price_list_id 
       FROM price_list 
       WHERE price_list_id = $1 AND builder_id = $2 
       LIMIT 1`,
      [price_list_id, builderId]
    );

    if (checkPriceList.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot add items in another builder's price list."
      );
    }

    const checkPriceListActive = await client.query(
      `SELECT price_list_id 
       FROM price_list 
       WHERE price_list_id = $1 AND builder_id = $2 AND is_active = true
       LIMIT 1`,
      [price_list_id, builderId]
    );

    if (checkPriceListActive.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot add items in inactive price list."
      );
    }

    if (range_id) {
      const checkRange = await client.query(
        `SELECT range_id FROM range 
         WHERE range_id = $1 AND builder_id = $2 LIMIT 1`,
        [range_id, builderId]
      );

      if (checkRange.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid range_id. Range does not belong to this builder."
        );
      }
    }

    if (range_id) {
      const checkRange = await client.query(
        `SELECT range_id FROM range 
         WHERE range_id = $1 AND builder_id = $2 AND is_active = true LIMIT 1`,
        [range_id, builderId]
      );

      if (checkRange.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive range id.");
      }
    }

    if (dwelling_type_id) {
      const checkDwelling = await client.query(
        `SELECT dwelling_type_id 
         FROM dwelling_type 
         WHERE dwelling_type_id = $1 AND builder_id = $2 LIMIT 1`,
        [dwelling_type_id, builderId]
      );

      if (checkDwelling.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid dwelling_type_id. Dwelling type does not belong to this builder."
        );
      }
    }

    if (dwelling_type_id) {
      const checkDwelling = await client.query(
        `SELECT dwelling_type_id 
         FROM dwelling_type 
         WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_active = true LIMIT 1`,
        [dwelling_type_id, builderId]
      );

      if (checkDwelling.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive dwelling_type_id.");
      }
    }

    if (cost_type === "Included") {
      if (!cost_type_text) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "cost_type_text is required when cost_type = 'Included'."
        );
      }

      if (
        cost_option !== undefined ||
        cost !== undefined ||
        builder_cost !== undefined
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "cost_option, cost, builder_cost are not allowed when cost_type = 'Included'."
        );
      }
    }

    if (cost_type === "Fixed" || cost_type === "Variable") {
      if (cost_type_text) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "cost_type_text is not allowed for cost_type = 'Fixed' or 'Variable'."
        );
      }

      if (
        cost_option === undefined ||
        cost === undefined ||
        builder_cost === undefined
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "cost_option, cost, builder_cost are required for cost_type = 'Fixed' or 'Variable'."
        );
      }
    }

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined) {
      const defaultSortCheckQuery = `
    SELECT price_list_item_id
    FROM price_list_item
    WHERE sort_order = 0
      AND company_id = $1
      AND builder_id = $2
      AND price_list_id = $3
  `;

      const defaultSortCheckResult = await client.query(defaultSortCheckQuery, [
        companyId,
        builderId,
        price_list_id,
      ]);

      if (defaultSortCheckResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Default sort order 0 already exists for this price list. Please provide a custom sort_order."
        );
      }

      finalSortOrder = 0;
    } else {
      const uniqueSortQuery = `
    SELECT price_list_item_id
    FROM price_list_item
    WHERE sort_order = $1
      AND company_id = $2
      AND builder_id = $3
      AND price_list_id = $4
  `;

      const uniqueSortResult = await client.query(uniqueSortQuery, [
        finalSortOrder,
        companyId,
        builderId,
        price_list_id,
      ]);

      if (uniqueSortResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Sort order ${finalSortOrder} already exists for this price list.`
        );
      }
    }

    const insertQuery = `
      INSERT INTO price_list_item (
        price_list_id,
        company_id,
        builder_id,
        item_description,
        short_description,
        cost_type,
        cost_type_text,
        cost_option,
        cost,
        builder_cost,
        sort_order,
        uom,
        status,
        include_by_default,
        allow_remove_from_quotation,
        show_in_hl_package,
        show_only_in_package,
        range_id,
        dwelling_type_id,
        conditions,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      RETURNING *;
    `;

    const values = [
      price_list_id,
      companyId,
      builderId,
      item_description,
      short_description || null,
      cost_type,
      cost_type_text || null,
      cost_option || "none",
      cost || null,
      builder_cost || null,
      finalSortOrder,
      uom || null,
      status || "active",
      include_by_default || false,
      allow_remove_from_quotation || false,
      show_in_hl_package || false,
      show_only_in_package || false,
      range_id || null,
      dwelling_type_id || null,
      conditions || null,
      userId || null,
      userId || null,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list item created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating price list item:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllPriceListItems = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    let {
      page = 1,
      limit = 25,
      status,
      cost_option,
      price,
      item_description,
      sort_order = "asc",
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    const allowedSort = ["asc", "desc"];
    if (!allowedSort.includes(sort_order.toLowerCase())) {
      sort_order = "asc";
    }

    let conditions = [];
    let values = [];
    let index = 1;

    conditions.push(`builder_id = $${index++}`);
    values.push(builderId);

    conditions.push(`company_id = $${index++}`);
    values.push(companyId);

    if (status) {
      conditions.push(`status = $${index++}`);
      values.push(status);
    }

    if (cost_option) {
      conditions.push(`cost_option = $${index++}`);
      values.push(cost_option);
    }

    if (price) {
      conditions.push(`cost = $${index++}`);
      values.push(price);
    }

    if (item_description) {
      conditions.push(`item_description ILIKE $${index++}`);
      values.push(`%${item_description}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM price_list_item
      ${whereClause}
    `;

    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    const mainQuery = `
      SELECT *
      FROM price_list_item
      ${whereClause}
      ORDER BY sort_order ${sort_order}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await client.query(mainQuery, values);

    return successResponse(
      res,
      {
        records: keysToCamelCase(result.rows),
        totalRecords: total,
        currentPage: page,
        limit: limit,
        totalPages: Math.ceil(total / limit),
      },
      "Price list items fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching price list items:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deletePriceListItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { priceListItemId } = req.params;

    const checkQuery = `
      SELECT price_list_item_id, builder_id
      FROM price_list_item
      WHERE price_list_item_id = $1
    `;
    const checkResult = await client.query(checkQuery, [priceListItemId]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Price list item not found.");
    }

    const item = checkResult.rows[0];

    if (item.builder_id !== builderId) {
      return errorResponse(
        res,
        403,
        "Permission denied. You can delete only your own record."
      );
    }

    const deleteQuery = `
      DELETE FROM price_list_item
      WHERE price_list_item_id = $1
    `;
    await client.query(deleteQuery, [priceListItemId]);

    return successResponse(res, 200, "Price list item deleted successfully.");
  } catch (error) {
    console.error("Error deleting price list item:", error);
    return errorResponse(res, 500, "Error deleting price list item.");
  } finally {
    client.release();
  }
};

exports.updatePriceListItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;
    const { price_list_item_id } = req.params;

    const {
      item_description,
      short_description,
      cost_type,
      cost_type_text,
      cost_option,
      cost,
      builder_cost,
      sort_order,
      uom,
      status,
      include_by_default,
      allow_remove_from_quotation,
      show_in_hl_package,
      show_only_in_package,
      range_id,
      dwelling_type_id,
      conditions,
    } = req.body;

    await client.query("BEGIN");

    const checkExisting = await client.query(
      `
      SELECT *
      FROM price_list_item
      WHERE price_list_item_id = $1
        AND builder_id = $2
        AND company_id = $3
      LIMIT 1
      `,
      [price_list_item_id, builderId, companyId]
    );

    if (checkExisting.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Item not found or unauthorized.");
    }

    const old = checkExisting.rows[0];
    const currentStatus = old.status;

    let requestedStatus;
    const statusInBody = req.body.status !== undefined;

    if (statusInBody) {
      const inputStatus = String(req.body.status).trim().toLowerCase();
      if (inputStatus === "active") {
        requestedStatus = "active";
      } else if (inputStatus === "inactive") {
        requestedStatus = "inactive";
      } else {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid value for status. Must be 'Active' or 'Inactive'."
        );
      }
    }

    const requestedStatusActive = requestedStatus === "active";
    const requestedStatusInactive = requestedStatus === "inactive";

    const fieldsToCheck = [
      "item_description",
      "short_description",
      "cost_type",
      "cost_type_text",
      "cost_option",
      "cost",
      "builder_cost",
      "sort_order",
      "uom",
      "include_by_default",
      "allow_remove_from_quotation",
      "show_in_hl_package",
      "show_only_in_package",
      "range_id",
      "dwelling_type_id",
      "conditions",
    ];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    if (currentStatus === "active" && statusInBody) {
      if (requestedStatusInactive) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To deactivate an active price list item, 'status' must be the only field provided in the request."
          );
        }
      }
    }

    if (currentStatus === "inactive") {
      if (requestedStatusActive) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive price list item, 'status' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        if (!requestedStatusActive) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Cannot update non-'status' fields when the price list item is currently Inactive. Only 'status' can be changed (to 'Active')."
          );
        }
      }

      if (statusInBody && requestedStatusInactive) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Price list item is already Inactive. 'status' can only be updated to 'Active' from this state."
        );
      }
    }

    if (req.body.price_list_id) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "You cannot update price_list_id.");
    }

    if (range_id) {
      const checkRange = await client.query(
        `SELECT range_id FROM range WHERE range_id = $1 AND builder_id = $2 LIMIT 1`,
        [range_id, builderId]
      );

      if (checkRange.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid range_id.");
      }
    }

    if (range_id) {
      const checkRange = await client.query(
        `SELECT range_id FROM range WHERE range_id = $1 AND builder_id = $2 AND is_active = true LIMIT 1`,
        [range_id, builderId]
      );

      if (checkRange.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive range_id.");
      }
    }

    if (dwelling_type_id) {
      const checkDwelling = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2 LIMIT 1`,
        [dwelling_type_id, builderId]
      );

      if (checkDwelling.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid dwelling_type_id.");
      }
    }

    if (dwelling_type_id) {
      const checkDwelling = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_active = true LIMIT 1`,
        [dwelling_type_id, builderId]
      );

      if (checkDwelling.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive dwelling_type_id.");
      }
    }

    let finalCostType = cost_type ?? old.cost_type;
    let finalCostTypeText;
    let finalCostOption;
    let finalCost;
    let finalBuilderCost;

    if (cost_type === "Included") {
      if (
        req.body.cost_option !== undefined ||
        req.body.cost !== undefined ||
        req.body.builder_cost !== undefined
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "You cannot send cost_option, cost, or builder_cost when cost_type = 'Included'."
        );
      }
    }

    if (cost_type !== undefined) {
      if (cost_type === "Included") {
        if (!cost_type_text) {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "cost_type_text is required.");
        }

        finalCostTypeText = cost_type_text;
        finalCostOption = null;
        finalCost = null;
        finalBuilderCost = null;
      }

      if (cost_type === "Fixed" || cost_type === "Variable") {
        if (cost_type_text) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "cost_type_text is not allowed when cost_type is Fixed or Variable."
          );
        }

        finalCostTypeText = null;

        finalCostOption = cost_option ?? old.cost_option;
        finalCost = cost ?? old.cost;
        finalBuilderCost = builder_cost ?? old.builder_cost;

        if (
          finalCostOption === null ||
          finalCost === null ||
          finalBuilderCost === null
        ) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "cost_option, cost and builder_cost are required."
          );
        }
      }
    } else {
      finalCostTypeText = old.cost_type_text;
      finalCostOption = old.cost_option;
      finalCost = old.cost;
      finalBuilderCost = old.builder_cost;
    }

    let finalSortOrder = sort_order ?? old.sort_order;

    if (sort_order !== undefined) {
      if (sort_order === 0) {
        const checkDefault = await client.query(
          `
          SELECT price_list_item_id
          FROM price_list_item
          WHERE sort_order = 0
            AND builder_id = $1
            AND company_id = $2
            AND price_list_id = $3
            AND price_list_item_id != $4
          `,
          [builderId, companyId, old.price_list_id, price_list_item_id]
        );

        if (checkDefault.rowCount > 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "Sort order 0 already exists.");
        }
      } else {
        const checkSort = await client.query(
          `
          SELECT price_list_item_id
          FROM price_list_item
          WHERE sort_order = $1
            AND builder_id = $2
            AND company_id = $3
            AND price_list_id = $4
            AND price_list_item_id != $5
          `,
          [
            sort_order,
            builderId,
            companyId,
            old.price_list_id,
            price_list_item_id,
          ]
        );

        if (checkSort.rowCount > 0) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            `Sort order ${sort_order} already exists.`
          );
        }
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    const push = (column, value) => {
      fields.push(`${column} = $${i++}`);
      values.push(value);
    };

    if (item_description) push("item_description", item_description);
    if (short_description !== undefined)
      push("short_description", short_description);

    if (cost_type) push("cost_type", finalCostType);
    push("cost_type_text", finalCostTypeText);
    push("cost_option", finalCostOption);
    push("cost", finalCost);
    push("builder_cost", finalBuilderCost);

    push("sort_order", finalSortOrder);

    if (uom !== undefined) push("uom", uom);
    if (requestedStatus) push("status", requestedStatus);

    if (include_by_default !== undefined)
      push("include_by_default", include_by_default);
    if (allow_remove_from_quotation !== undefined)
      push("allow_remove_from_quotation", allow_remove_from_quotation);
    if (show_in_hl_package !== undefined)
      push("show_in_hl_package", show_in_hl_package);
    if (show_only_in_package !== undefined)
      push("show_only_in_package", show_only_in_package);
    if (range_id !== undefined) push("range_id", range_id);
    if (dwelling_type_id !== undefined)
      push("dwelling_type_id", dwelling_type_id);
    if (conditions !== undefined) push("conditions", conditions);

    push("updated_by", userId);

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update."
      );
    }

    values.push(price_list_item_id);

    const updateQuery = `
      UPDATE price_list_item
      SET ${fields.join(", ")}
      WHERE price_list_item_id = $${i}
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Price list item updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating price list item:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
