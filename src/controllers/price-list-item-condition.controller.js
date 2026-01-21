const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPriceListItemCondition = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      price_list_item_id,
      condition_name,
      status,
      range_start,
      range_end,
    } = req.body;
    const { user_id, company_id, builder_id } = req.user;

    if (!price_list_item_id) {
      return errorResponse(res, 400, "price_list_item_id is required");
    }

    if (!condition_name) {
      return errorResponse(res, 400, "condition_name is required");
    }

    const validConditions = [
      "site_fall",
      "land_size",
      "corner_block",
      "land_fill",
    ];
    if (!validConditions.includes(condition_name)) {
      return errorResponse(
        res,
        400,
        `Invalid condition_name. Must be one of: ${validConditions.join(", ")}`,
      );
    }

    const priceListItemCheck = await client.query(
      `SELECT price_list_item_id 
       FROM price_list_item 
       WHERE price_list_item_id = $1 
         AND (company_id = $2 OR builder_id = $3)`,
      [price_list_item_id, company_id, builder_id],
    );

    if (priceListItemCheck.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Price list item not found or unauthorized",
      );
    }

    if (condition_name === "corner_block") {
      if (range_start !== undefined || range_end !== undefined) {
        return errorResponse(
          res,
          400,
          "range_start and range_end are not applicable for corner_block condition",
        );
      }
      if (status === undefined) {
        return errorResponse(
          res,
          400,
          "status is required for corner_block condition",
        );
      }
    } else {
      if (range_start === undefined || range_end === undefined) {
        return errorResponse(
          res,
          400,
          "range_start and range_end are required for this condition",
        );
      }
      if (range_start >= range_end) {
        return errorResponse(
          res,
          400,
          "range_start must be less than range_end",
        );
      }
    }

    const existingCondition = await client.query(
      `SELECT price_list_item_condition_id 
       FROM price_list_item_condition 
       WHERE price_list_item_id = $1 AND condition_name = $2`,
      [price_list_item_id, condition_name],
    );

    if (existingCondition.rowCount > 0) {
      return errorResponse(
        res,
        400,
        `Condition '${condition_name}' already exists for this price list item`,
      );
    }

    const insertQuery = `
      INSERT INTO price_list_item_condition (
        price_list_item_id,
        condition_name,
        status,
        range_start,
        range_end
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const values = [
      price_list_item_id,
      condition_name,
      condition_name === "corner_block" ? status : null,
      condition_name === "corner_block" ? null : range_start,
      condition_name === "corner_block" ? null : range_end,
    ];

    const result = await client.query(insertQuery, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list item condition created successfully",
    );
  } catch (error) {
    console.error("Error creating price list item condition:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllPriceListItemConditions = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { price_list_item_id } = req.query;
    const { company_id, builder_id } = req.user;

    let whereClause = "WHERE (pli.company_id = $1 OR pli.builder_id = $2)";
    let values = [company_id, builder_id];
    let paramIndex = values.length + 1;

    if (price_list_item_id) {
      whereClause += ` AND plic.price_list_item_id = $${paramIndex++}`;
      values.push(price_list_item_id);
    }

    const query = `
      SELECT 
        plic.price_list_item_condition_id,
        plic.price_list_item_id,
        plic.condition_name,
        plic.status,
        plic.range_start,
        plic.range_end,
        plic.created_at,
        plic.updated_at,
        pli.item_description
      FROM price_list_item_condition plic
      JOIN price_list_item pli ON pli.price_list_item_id = plic.price_list_item_id
      ${whereClause}
      ORDER BY plic.created_at DESC;
    `;

    const result = await client.query(query, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Price list item conditions fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching price list item conditions:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPriceListItemConditionById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { price_list_item_condition_id } = req.params;
    const { company_id, builder_id } = req.user;

    if (!price_list_item_condition_id) {
      return errorResponse(
        res,
        400,
        "price_list_item_condition_id is required",
      );
    }

    const query = `
      SELECT 
        plic.price_list_item_condition_id,
        plic.price_list_item_id,
        plic.condition_name,
        plic.status,
        plic.range_start,
        plic.range_end,
        plic.created_at,
        plic.updated_at,
        pli.item_description
      FROM price_list_item_condition plic
      JOIN price_list_item pli ON pli.price_list_item_id = plic.price_list_item_id
      WHERE plic.price_list_item_condition_id = $1 
        AND (pli.company_id = $2 OR pli.builder_id = $3);
    `;

    const result = await client.query(query, [
      price_list_item_condition_id,
      company_id,
      builder_id,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Price list item condition not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list item condition fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching price list item condition:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updatePriceListItemCondition = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { price_list_item_condition_id } = req.params;
    const { condition_name, status, range_start, range_end } = req.body;
    const { user_id, company_id, builder_id } = req.user;

    if (!price_list_item_condition_id) {
      return errorResponse(
        res,
        400,
        "price_list_item_condition_id is required",
      );
    }

    const existingCondition = await client.query(
      `SELECT plic.*, pli.company_id, pli.builder_id
       FROM price_list_item_condition plic
       JOIN price_list_item pli ON pli.price_list_item_id = plic.price_list_item_id
       WHERE plic.price_list_item_condition_id = $1 
         AND (pli.company_id = $2 OR pli.builder_id = $3)`,
      [price_list_item_condition_id, company_id, builder_id],
    );

    if (existingCondition.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Price list item condition not found or unauthorized",
      );
    }

    const currentCondition = existingCondition.rows[0];
    let finalConditionName = condition_name || currentCondition.condition_name;

    if (condition_name && condition_name !== currentCondition.condition_name) {
      const validConditions = [
        "site_fall",
        "land_size",
        "corner_block",
        "land_fill",
      ];
      if (!validConditions.includes(condition_name)) {
        return errorResponse(
          res,
          400,
          `Invalid condition_name. Must be one of: ${validConditions.join(", ")}`,
        );
      }

      const duplicateCondition = await client.query(
        `SELECT price_list_item_condition_id 
         FROM price_list_item_condition 
         WHERE price_list_item_id = $1 AND condition_name = $2 AND price_list_item_condition_id != $3`,
        [
          currentCondition.price_list_item_id,
          condition_name,
          price_list_item_condition_id,
        ],
      );

      if (duplicateCondition.rowCount > 0) {
        return errorResponse(
          res,
          400,
          `Condition '${condition_name}' already exists for this price list item`,
        );
      }
    }

    if (finalConditionName === "corner_block") {
      if (range_start !== undefined || range_end !== undefined) {
        return errorResponse(
          res,
          400,
          "range_start and range_end are not applicable for corner_block condition",
        );
      }
    } else {
      if (
        range_start !== undefined &&
        range_end !== undefined &&
        range_start >= range_end
      ) {
        return errorResponse(
          res,
          400,
          "range_start must be less than range_end",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (condition_name && condition_name !== currentCondition.condition_name) {
      if (condition_name === "corner_block") {
        updateFields.push(`range_start = $${paramIndex++}`);
        updateValues.push(null);
        updateFields.push(`range_end = $${paramIndex++}`);
        updateValues.push(null);
      } else {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(null);

        if (range_start === undefined) {
          updateFields.push(`range_start = $${paramIndex++}`);
          updateValues.push(null);
        }
        if (range_end === undefined) {
          updateFields.push(`range_end = $${paramIndex++}`);
          updateValues.push(null);
        }
      }
    }

    if (condition_name !== undefined) {
      updateFields.push(`condition_name = $${paramIndex++}`);
      updateValues.push(condition_name);
    }

    if (status !== undefined) {
      if (finalConditionName === "corner_block") {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(status);
      }
    }

    if (range_start !== undefined && finalConditionName !== "corner_block") {
      updateFields.push(`range_start = $${paramIndex++}`);
      updateValues.push(range_start);
    }

    if (range_end !== undefined && finalConditionName !== "corner_block") {
      updateFields.push(`range_end = $${paramIndex++}`);
      updateValues.push(range_end);
    }

    if (updateFields.length === 0) {
      return errorResponse(
        res,
        400,
        "At least one field is required for update",
      );
    }

    updateFields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE price_list_item_condition
      SET ${updateFields.join(", ")}
      WHERE price_list_item_condition_id = $${paramIndex}
      RETURNING *;
    `;

    updateValues.push(price_list_item_condition_id);

    const result = await client.query(updateQuery, updateValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list item condition updated successfully",
    );
  } catch (error) {
    console.error("Error updating price list item condition:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deletePriceListItemCondition = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { price_list_item_condition_id } = req.params;
    const { company_id, builder_id } = req.user;

    if (!price_list_item_condition_id) {
      return errorResponse(
        res,
        400,
        "price_list_item_condition_id is required",
      );
    }

    const existingCondition = await client.query(
      `SELECT plic.price_list_item_condition_id
       FROM price_list_item_condition plic
       JOIN price_list_item pli ON pli.price_list_item_id = plic.price_list_item_id
       WHERE plic.price_list_item_condition_id = $1 
         AND (pli.company_id = $2 OR pli.builder_id = $3)`,
      [price_list_item_condition_id, company_id, builder_id],
    );

    if (existingCondition.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Price list item condition not found or unauthorized",
      );
    }

    const deleteQuery = `
      DELETE FROM price_list_item_condition
      WHERE price_list_item_condition_id = $1
      RETURNING *;
    `;

    const result = await client.query(deleteQuery, [
      price_list_item_condition_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list item condition deleted successfully",
    );
  } catch (error) {
    console.error("Error deleting price list item condition:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
