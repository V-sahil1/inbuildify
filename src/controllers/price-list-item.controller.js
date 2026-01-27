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
    } = req.body;

    if (range_id) {
      const rangeIdsArray = Array.isArray(range_id) ? range_id : [range_id];

      for (const id of rangeIdsArray) {
        if (id) {
          const rangeCheck = await client.query(
            `SELECT 1 FROM range WHERE range_id = $1 AND is_active = true`,
            [id],
          );

          if (rangeCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid range ID: ${id}. Range does not exist or is not active.`,
            );
          }
        }
      }
    }

    if (dwelling_type_id) {
      const dwellingTypeIdsArray = Array.isArray(dwelling_type_id)
        ? dwelling_type_id
        : [dwelling_type_id];

      for (const id of dwellingTypeIdsArray) {
        if (id) {
          const dwellingTypeCheck = await client.query(
            `SELECT 1 FROM dwelling_type WHERE dwelling_type_id = $1 AND is_active = true`,
            [id],
          );

          if (dwellingTypeCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid dwelling type ID: ${id}. Dwelling type does not exist or is not active.`,
            );
          }
        }
      }
    }

    await client.query("BEGIN");

    const checkPriceList = await client.query(
      `SELECT price_list_id 
       FROM price_list 
       WHERE price_list_id = $1 AND builder_id = $2 
       LIMIT 1`,
      [price_list_id, builderId],
    );

    if (checkPriceList.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot add items in another builder's price list.",
      );
    }

    const checkPriceListActive = await client.query(
      `SELECT price_list_id 
       FROM price_list 
       WHERE price_list_id = $1 AND builder_id = $2 AND is_active = true
       LIMIT 1`,
      [price_list_id, builderId],
    );

    if (checkPriceListActive.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot add items in inactive price list.",
      );
    }

    if (cost_type === "Included") {
      if (!cost_type_text) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "cost_type_text is required when cost_type = 'Included'.",
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
          "cost_option, cost, builder_cost are not allowed when cost_type = 'Included'.",
        );
      }
    }

    if (cost_type === "Fixed" || cost_type === "Variable") {
      if (cost_type_text) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "cost_type_text is not allowed for cost_type = 'Fixed' or 'Variable'.",
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
          "cost_option, cost, builder_cost are required for cost_type = 'Fixed' or 'Variable'.",
        );
      }
    }

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) as max_sort
        FROM price_list_item
        WHERE company_id = $1 AND builder_id = $2 AND price_list_id = $3
      `;

      const maxSortResult = await client.query(maxSortQuery, [
        companyId,
        builderId,
        price_list_id,
      ]);

      finalSortOrder = (maxSortResult.rows[0].max_sort || 0) + 1;
    } else {
      await client.query(
        `UPDATE price_list_item
         SET sort_order = sort_order + 1
         WHERE company_id = $1 AND builder_id = $2 AND price_list_id = $3 AND sort_order >= $4`,
        [companyId, builderId, price_list_id, finalSortOrder],
      );
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
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21
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
      userId || null,
      userId || null,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    // Get the complete data with nested relationships
    const getCreatedItemQuery = `
      SELECT 
        pli.*,
        pl.name as price_list_name,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', r.range_id,
              'name', r.name
            )
          )
          FROM range r
          WHERE r.range_id = ANY(pli.range_id) AND r.is_active = true
        ) as range_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          )
          FROM dwelling_type dt
          WHERE dt.dwelling_type_id = ANY(pli.dwelling_type_id) AND dt.is_active = true
        ) as dwelling_type_data
      FROM price_list_item pli
      LEFT JOIN price_list pl ON pli.price_list_id = pl.price_list_id
      WHERE pli.price_list_item_id = $1
    `;

    const createdItemResult = await client.query(getCreatedItemQuery, [
      result.rows[0].price_list_item_id,
    ]);
    const createdItem = keysToCamelCase(createdItemResult.rows[0]);

    // Format the response to match the specified structure
    const formattedItem = {
      priceListItemId: createdItem.priceListItemId,
      priceList: {
        id: createdItem.priceListId,
        name: createdItem.priceListName,
      },
      companyId: createdItem.companyId,
      builderId: createdItem.builderId,
      itemDescription: createdItem.itemDescription,
      shortDescription: createdItem.shortDescription,
      costType: createdItem.costType,
      costTypeText: createdItem.costTypeText,
      costOption: createdItem.costOption,
      cost: createdItem.cost ? createdItem.cost.toString() : null,
      builderCost: createdItem.builderCost
        ? createdItem.builderCost.toString()
        : null,
      sortOrder: createdItem.sortOrder,
      uom: createdItem.uom,
      status: createdItem.status,
      includeByDefault: createdItem.includeByDefault,
      allowRemoveFromQuotation: createdItem.allowRemoveFromQuotation,
      showInHlPackage: createdItem.showInHlPackage,
      showOnlyInPackage: createdItem.showOnlyInPackage,
      range: createdItem.rangeData || [],
      dwellingType: createdItem.dwellingTypeData || [],
      createdBy: createdItem.createdBy,
      updatedBy: createdItem.updatedBy,
      createdAt: createdItem.createdAt,
      updatedAt: createdItem.updatedAt,
    };

    return successResponse(
      res,
      formattedItem,
      "Price list item created successfully.",
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
      cost_type,
      uom,
      price,
      item_description,
      price_list_id,
      dwelling_type_id,
      range_id,
      location_id,
      sort_order,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    let conditions = [];
    let values = [];
    let index = 1;

    conditions.push(`pli.builder_id = $${index++}`);
    values.push(builderId);

    conditions.push(`pli.company_id = $${index++}`);
    values.push(companyId);

    if (status) {
      conditions.push(`pli.status = $${index++}`);
      values.push(status);
    }

    if (cost_option) {
      conditions.push(`pli.cost_option = $${index++}`);
      values.push(cost_option);
    }

    if (cost_type) {
      conditions.push(`pli.cost_type = $${index++}`);
      values.push(cost_type);
    }

    if (uom) {
      conditions.push(`pli.uom = $${index++}`);
      values.push(uom);
    }

    if (price) {
      conditions.push(`pli.cost = $${index++}`);
      values.push(price);
    }

    if (item_description) {
      conditions.push(`pli.item_description ILIKE $${index++}`);
      values.push(`%${item_description}%`);
    }

    if (price_list_id) {
      conditions.push(`pli.price_list_id = $${index++}`);
      values.push(price_list_id);
    }

    if (dwelling_type_id) {
      conditions.push(`$${index++} = ANY(pli.dwelling_type_id)`);
      values.push(dwelling_type_id);
    }

    if (range_id) {
      conditions.push(`$${index++} = ANY(pli.range_id)`);
      values.push(range_id);
    }

    if (location_id) {
      conditions.push(`pl.location = $${index++}`);
      values.push(location_id);
    }

    if (sort_order !== undefined && sort_order !== "") {
      const sortValue = Number(sort_order);
      if (isNaN(sortValue)) {
        return errorResponse(res, 400, "sort_order must be a valid number");
      }
      conditions.push(`pli.sort_order = $${index++}`);
      values.push(sortValue);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM price_list_item pli
      LEFT JOIN price_list pl ON pli.price_list_id = pl.price_list_id
      ${whereClause}
    `;

    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    const mainQuery = `
      SELECT 
        pli.*,
        pl.name AS price_list_name,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', r.range_id,
              'name', r.name
            )
          )
          FROM range r
          WHERE r.range_id = ANY(pli.range_id)
            AND r.is_active = true
        ) AS range_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          )
          FROM dwelling_type dt
          WHERE dt.dwelling_type_id = ANY(pli.dwelling_type_id)
            AND dt.is_active = true
        ) AS dwelling_type_data
      FROM price_list_item pli
      LEFT JOIN price_list pl ON pli.price_list_id = pl.price_list_id
      ${whereClause}
      ORDER BY pli.sort_order ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await client.query(mainQuery, values);

    const formattedItems = result.rows.map((row) => {
      const item = keysToCamelCase(row);

      return {
        priceListItemId: item.priceListItemId,
        priceList: {
          id: item.priceListId,
          name: item.priceListName,
        },
        companyId: item.companyId,
        builderId: item.builderId,
        itemDescription: item.itemDescription,
        shortDescription: item.shortDescription,
        costType: item.costType,
        costTypeText: item.costTypeText,
        costOption: item.costOption,
        cost: item.cost ? item.cost.toString() : null,
        builderCost: item.builderCost ? item.builderCost.toString() : null,
        sortOrder: item.sortOrder,
        uom: item.uom,
        status: item.status,
        includeByDefault: item.includeByDefault,
        allowRemoveFromQuotation: item.allowRemoveFromQuotation,
        showInHlPackage: item.showInHlPackage,
        showOnlyInPackage: item.showOnlyInPackage,
        range: item.rangeData || [],
        dwellingType: item.dwellingTypeData || [],
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return successResponse(
      res,
      {
        priceListItem: formattedItems,
        pagination: {
          totalRecords: total,
          currentPage: page,
          limit: limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Price list items fetched successfully.",
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
    const companyId = req.user.company_id;
    const { priceListItemId } = req.params;

    const checkQuery = `
      SELECT price_list_item_id, builder_id, company_id, price_list_id, sort_order
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
        "Permission denied. You can delete only your own record.",
      );
    }

    const deletedSortOrder = item.sort_order;
    const priceListId = item.price_list_id;

    const deleteQuery = `
      DELETE FROM price_list_item
      WHERE price_list_item_id = $1
    `;
    await client.query(deleteQuery, [priceListItemId]);

    await client.query(
      `UPDATE price_list_item 
       SET sort_order = sort_order - 1 
       WHERE company_id = $1 AND builder_id = $2 AND price_list_id = $3 AND sort_order > $4`,
      [companyId, builderId, priceListId, deletedSortOrder],
    );

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
    } = req.body;

    if (range_id) {
      const rangeIdsArray = Array.isArray(range_id) ? range_id : [range_id];

      for (const id of rangeIdsArray) {
        if (id) {
          const rangeCheck = await client.query(
            `SELECT 1 FROM range WHERE range_id = $1 AND is_active = true`,
            [id],
          );

          if (rangeCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid range ID: ${id}. Range does not exist or is not active.`,
            );
          }
        }
      }
    }

    if (dwelling_type_id) {
      const dwellingTypeIdsArray = Array.isArray(dwelling_type_id)
        ? dwelling_type_id
        : [dwelling_type_id];

      for (const id of dwellingTypeIdsArray) {
        if (id) {
          const dwellingTypeCheck = await client.query(
            `SELECT 1 FROM dwelling_type WHERE dwelling_type_id = $1 AND is_active = true`,
            [id],
          );

          if (dwellingTypeCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid dwelling type ID: ${id}. Dwelling type does not exist or is not active.`,
            );
          }
        }
      }
    }

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
      [price_list_item_id, builderId, companyId],
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
          "Invalid value for status. Must be 'Active' or 'Inactive'.",
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
    ];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    if (currentStatus === "active" && statusInBody) {
      if (requestedStatusInactive) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To deactivate an active price list item, 'status' must be the only field provided in the request.",
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
            "To activate an inactive price list item, 'status' must be the only field provided in the request.",
          );
        }
      }

      if (updatingOtherFields) {
        if (!requestedStatusActive) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Cannot update non-'status' fields when the price list item is currently Inactive. Only 'status' can be changed (to 'Active').",
          );
        }
      }

      if (statusInBody && requestedStatusInactive) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Price list item is already Inactive. 'status' can only be updated to 'Active' from this state.",
        );
      }
    }

    if (req.body.price_list_id) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "You cannot update price_list_id.");
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
          "You cannot send cost_option, cost, or builder_cost when cost_type = 'Included'.",
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
            "cost_type_text is not allowed when cost_type is Fixed or Variable.",
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
            "cost_option, cost and builder_cost are required.",
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
    const oldSortOrder = old.sort_order;

    if (sort_order !== undefined && sort_order !== oldSortOrder) {
      if (sort_order < oldSortOrder) {
        await client.query(
          `UPDATE price_list_item
           SET sort_order = sort_order + 1
           WHERE company_id = $1 AND builder_id = $2 AND price_list_id = $3 
             AND sort_order >= $4 AND sort_order < $5 AND price_list_item_id != $6`,
          [
            companyId,
            builderId,
            old.price_list_id,
            sort_order,
            oldSortOrder,
            price_list_item_id,
          ],
        );
      } else if (sort_order > oldSortOrder) {
        await client.query(
          `UPDATE price_list_item
           SET sort_order = sort_order - 1
           WHERE company_id = $1 AND builder_id = $2 AND price_list_id = $3 
             AND sort_order > $4 AND sort_order <= $5 AND price_list_item_id != $6`,
          [
            companyId,
            builderId,
            old.price_list_id,
            oldSortOrder,
            sort_order,
            price_list_item_id,
          ],
        );
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

    push("updated_by", userId);

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
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

    // Get the complete updated data with nested relationships
    const getUpdatedItemQuery = `
      SELECT 
        pli.*,
        pl.name as price_list_name,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', r.range_id,
              'name', r.name
            )
          )
          FROM range r
          WHERE r.range_id = ANY(pli.range_id) AND r.is_active = true
        ) as range_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          )
          FROM dwelling_type dt
          WHERE dt.dwelling_type_id = ANY(pli.dwelling_type_id) AND dt.is_active = true
        ) as dwelling_type_data
      FROM price_list_item pli
      LEFT JOIN price_list pl ON pli.price_list_id = pl.price_list_id
      WHERE pli.price_list_item_id = $1
    `;

    const updatedItemResult = await client.query(getUpdatedItemQuery, [
      price_list_item_id,
    ]);
    const updatedItem = keysToCamelCase(updatedItemResult.rows[0]);

    // Format the response to match the specified structure
    const formattedItem = {
      priceListItemId: updatedItem.priceListItemId,
      priceList: {
        id: updatedItem.priceListId,
        name: updatedItem.priceListName,
      },
      companyId: updatedItem.companyId,
      builderId: updatedItem.builderId,
      itemDescription: updatedItem.itemDescription,
      shortDescription: updatedItem.shortDescription,
      costType: updatedItem.costType,
      costTypeText: updatedItem.costTypeText,
      costOption: updatedItem.costOption,
      cost: updatedItem.cost ? updatedItem.cost.toString() : null,
      builderCost: updatedItem.builderCost
        ? updatedItem.builderCost.toString()
        : null,
      sortOrder: updatedItem.sortOrder,
      uom: updatedItem.uom,
      status: updatedItem.status,
      includeByDefault: updatedItem.includeByDefault,
      allowRemoveFromQuotation: updatedItem.allowRemoveFromQuotation,
      showInHlPackage: updatedItem.showInHlPackage,
      showOnlyInPackage: updatedItem.showOnlyInPackage,
      range: updatedItem.rangeData || [],
      dwellingType: updatedItem.dwellingTypeData || [],
      createdBy: updatedItem.createdBy,
      updatedBy: updatedItem.updatedBy,
      createdAt: updatedItem.createdAt,
      updatedAt: updatedItem.updatedAt,
    };

    return successResponse(
      res,
      formattedItem,
      "Price list item updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating price list item:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
