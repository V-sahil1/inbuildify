const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createColorItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      item_name,
      item_code,
      supplier_id,
      color_category_id,
      upgrade_option,
      cost_type = "standard",
      cost,
      features,
      description,
      units = "non_mandatory",
      status = true,
    } = req.body;

    const specificationImage = req.files?.specification?.[0]?.location || null;
    const colorItemImage = req.files?.colorImage?.[0]?.location || null;

    if (!item_name || item_name.trim() === "") {
      return errorResponse(res, 400, "Item name is required.");
    }

    if (!item_code || item_code.trim() === "") {
      return errorResponse(res, 400, "Item code is required.");
    }

    if (cost_type === "standard") {
      if (upgrade_option) {
        return errorResponse(
          res,
          400,
          "Upgrade option cannot be set when cost type is standard.",
        );
      }
      if (cost) {
        return errorResponse(
          res,
          400,
          "Cost cannot be set when cost type is standard.",
        );
      }
    } else if (cost_type === "upgrade") {
      if (!upgrade_option) {
        return errorResponse(
          res,
          400,
          "Upgrade option is required when cost type is upgrade.",
        );
      }
      if (!["fixed", "start_from", "tba"].includes(upgrade_option)) {
        return errorResponse(
          res,
          400,
          "Upgrade option must be one of: fixed, start_from, tba.",
        );
      }
      if (upgrade_option === "tba" && cost) {
        return errorResponse(
          res,
          400,
          "Cost cannot be set when upgrade option is tba.",
        );
      }
      if (upgrade_option !== "tba" && !cost) {
        return errorResponse(
          res,
          400,
          "Cost is required when upgrade option is not tba.",
        );
      }
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color_item
      WHERE (company_id = $1 OR builder_id = $2)
        AND item_code = $3
      `,
      [companyId, builderId, item_code.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Item code already exists.");
    }

    if (supplier_id) {
      const supplierCheck = await client.query(
        `
        SELECT 1
        FROM supplier
        WHERE supplier_id = $1
          AND (company_id = $2 OR builder_id = $3)
        `,
        [supplier_id, companyId, builderId],
      );

      if (supplierCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid supplier ID.");
      }
    }

    if (color_category_id) {
      const colorCategoryCheck = await client.query(
        `
        SELECT 1
        FROM color_category cc
        JOIN color c ON cc.color_id = c.color_id
        WHERE cc.color_category_id = $1 
          AND (c.company_id = $2 OR c.builder_id = $3)
        `,
        [color_category_id, companyId, builderId],
      );

      if (colorCategoryCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid color category ID or access denied.",
        );
      }
    }

    const insertQuery = `
      INSERT INTO color_item (
        company_id,
        builder_id,
        color_category_id,
        item_name,
        item_code,
        supplier_id,
        upgrade_option,
        cost_type,
        cost,
        features,
        description,
        units,
        color_image,
        specification,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      color_category_id || null,
      item_name.trim(),
      item_code.trim(),
      supplier_id || null,
      upgrade_option || null,
      cost_type,
      cost || null,
      features?.trim() || null,
      description?.trim() || null,
      units,
      colorItemImage,
      specificationImage,
      status,
    ];

    const result = await client.query(insertQuery, values);
    const createdColorItem = keysToCamelCase(result.rows[0]);

    await client.query("COMMIT");

    return successResponse(
      res,
      createdColorItem,
      "Color item created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Color Item Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Item code already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllColorItems = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    let {
      page = 1,
      limit = 25,
      status,
      search,
      costType,
      upgradeOption,
      units,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const offset = (page - 1) * limit;

    let conditions = [`(ci.company_id = $1 OR ci.builder_id = $2)`];
    let values = [companyId, builderId];
    let index = 3;

    if (status !== undefined) {
      if (!["true", "false"].includes(status)) {
        return errorResponse(res, 400, "status must be true or false");
      }
      conditions.push(`ci.status = $${index}`);
      values.push(status === "true");
      index++;
    }

    if (costType !== undefined) {
      if (!["standard", "upgrade"].includes(costType)) {
        return errorResponse(res, 400, "cost_type must be standard or upgrade");
      }
      conditions.push(`ci.cost_type = $${index}`);
      values.push(costType);
      index++;
    }

    if (upgradeOption !== undefined) {
      if (!["fixed", "start_from", "tba"].includes(upgradeOption)) {
        return errorResponse(
          res,
          400,
          "upgrade_option must be fixed, start_from, or tba",
        );
      }
      conditions.push(`ci.upgrade_option = $${index}`);
      values.push(upgradeOption);
      index++;
    }

    if (units !== undefined) {
      if (!["mandatory", "non_mandatory", "not_required"].includes(units)) {
        return errorResponse(
          res,
          400,
          "units must be mandatory, non_mandatory, or not_required",
        );
      }
      conditions.push(`ci.units = $${index}`);
      values.push(units);
      index++;
    }

    if (search !== undefined && search.trim() !== "") {
      conditions.push(
        `(LOWER(ci.item_name) LIKE LOWER($${index}) OR LOWER(ci.item_code) LIKE LOWER($${index + 1}))`,
      );
      values.push(`%${search.trim()}%`, `%${search.trim()}%`);
      index += 2;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM color_item ci
      ${whereClause};
    `;

    const listQuery = `
      SELECT ci.*
      FROM color_item ci
      ${whereClause}
      ORDER BY ci.created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const [countResult, listResult] = await Promise.all([
      client.query(countQuery, values),
      client.query(listQuery, values),
    ]);

    const rows = keysToCamelCase(listResult.rows);
    const total = parseInt(countResult.rows[0].total, 10);

    const pagination = {
      totalRecords: total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return successResponse(
      res,
      {
        colorItems: rows,
        pagination,
      },
      "Color items fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching color items:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateColorItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { color_item_id } = req.params;

    if (!color_item_id) {
      return errorResponse(res, 400, "Color item ID is required.");
    }

    const {
      item_name,
      item_code,
      supplier_id,
      upgrade_option: reqUpgradeOption,
      cost_type: reqCostType,
      cost: reqCost,
      features,
      description,
      units,
      status,
    } = req.body;

    let upgrade_option = reqUpgradeOption;
    let cost_type = reqCostType;
    let cost = reqCost;

    const specificationImage = req.files?.specification?.[0]?.location;
    const colorItemImage = req.files?.color_image?.[0].location;

    if (cost_type !== undefined) {
      if (cost_type === "standard") {
        if (upgrade_option !== undefined) {
          return errorResponse(
            res,
            400,
            "Upgrade option cannot be set when cost type is standard.",
          );
        }
        if (cost !== undefined) {
          return errorResponse(
            res,
            400,
            "Cost cannot be set when cost type is standard.",
          );
        }
      } else if (cost_type === "upgrade") {
        if (
          upgrade_option !== undefined &&
          !["fixed", "start_from", "tba"].includes(upgrade_option)
        ) {
          return errorResponse(
            res,
            400,
            "Upgrade option must be one of: fixed, start_from, tba.",
          );
        }
        if (upgrade_option === "tba" && cost !== undefined) {
          return errorResponse(
            res,
            400,
            "Cost cannot be set when upgrade option is tba.",
          );
        }
        if (
          upgrade_option !== undefined &&
          upgrade_option !== "tba" &&
          cost === undefined
        ) {
          return errorResponse(
            res,
            400,
            "Cost is required when upgrade option is not tba.",
          );
        }
      }
    }

    if (cost_type === undefined && upgrade_option !== undefined) {
      if (!["fixed", "start_from", "tba"].includes(upgrade_option)) {
        return errorResponse(
          res,
          400,
          "Upgrade option must be one of: fixed, start_from, tba.",
        );
      }
      if (upgrade_option === "tba" && cost !== undefined) {
        return errorResponse(
          res,
          400,
          "Cost cannot be set when upgrade option is tba.",
        );
      }
    }

    const existingCheck = await client.query(
      `
      SELECT color_item_id, item_code, color_image, cost_type, upgrade_option, cost
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    const existing = existingCheck.rows[0];

    if (cost_type !== undefined) {
      if (cost_type === "standard") {
        if (upgrade_option !== undefined) {
          return errorResponse(
            res,
            400,
            "Upgrade option cannot be set when cost type is standard.",
          );
        }
        if (cost !== undefined) {
          return errorResponse(
            res,
            400,
            "Cost cannot be set when cost type is standard.",
          );
        }

        upgrade_option = null;
        cost = null;
      } else if (cost_type === "upgrade") {
        if (
          upgrade_option !== undefined &&
          !["fixed", "start_from", "tba"].includes(upgrade_option)
        ) {
          return errorResponse(
            res,
            400,
            "Upgrade option must be one of: fixed, start_from, tba.",
          );
        }
        if (upgrade_option === "tba" && cost !== undefined) {
          return errorResponse(
            res,
            400,
            "Cost cannot be set when upgrade option is tba.",
          );
        }
        if (
          upgrade_option !== undefined &&
          upgrade_option !== "tba" &&
          cost === undefined
        ) {
          return errorResponse(
            res,
            400,
            "Cost is required when upgrade option is not tba.",
          );
        }
      }
    }

    if (cost_type === undefined && upgrade_option !== undefined) {
      if (!["fixed", "start_from", "tba"].includes(upgrade_option)) {
        return errorResponse(
          res,
          400,
          "Upgrade option must be one of: fixed, start_from, tba.",
        );
      }
      if (upgrade_option === "tba" && cost !== undefined) {
        return errorResponse(
          res,
          400,
          "Cost cannot be set when upgrade option is tba.",
        );
      }
      if (upgrade_option === "tba") {
        cost = null;
      }
    }

    if (
      cost !== undefined &&
      cost_type === undefined &&
      upgrade_option === undefined
    ) {
      if (existing.cost_type === "standard") {
        return errorResponse(
          res,
          400,
          "Cost cannot be set when cost type is standard.",
        );
      }
      if (
        existing.cost_type === "upgrade" &&
        existing.upgrade_option === "tba"
      ) {
        return errorResponse(
          res,
          400,
          "Cost cannot be set when upgrade option is tba.",
        );
      }
    }

    if (
      upgrade_option !== undefined &&
      cost_type === undefined &&
      cost === undefined
    ) {
      if (existing.cost_type === "standard") {
        return errorResponse(
          res,
          400,
          "Upgrade option cannot be set when cost type is standard.",
        );
      }

      if (upgrade_option === "tba" && existing.cost !== null) {
        return errorResponse(
          res,
          400,
          "Cannot set upgrade option to tba when cost is already set.",
        );
      }
      if (upgrade_option !== "tba" && existing.cost === null) {
        return errorResponse(
          res,
          400,
          "Cost is required when upgrade option is not tba.",
        );
      }
    }

    if (item_code && item_code.trim() !== existing.item_code) {
      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM color_item
        WHERE (company_id = $1 OR builder_id = $2)
          AND item_code = $3
          AND color_item_id != $4
        `,
        [companyId, builderId, item_code.trim(), color_item_id],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Item code already exists.");
      }
    }

    if (supplier_id) {
      const supplierCheck = await client.query(
        `
        SELECT 1
        FROM supplier
        WHERE supplier_id = $1
          AND (company_id = $2 OR builder_id = $3)
        `,
        [supplier_id, companyId, builderId],
      );

      if (supplierCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid supplier ID.");
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (item_name !== undefined) {
      updateFields.push(`item_name = $${paramIndex++}`);
      updateValues.push(item_name.trim());
    }

    if (item_code !== undefined) {
      updateFields.push(`item_code = $${paramIndex++}`);
      updateValues.push(item_code.trim());
    }

    if (supplier_id !== undefined) {
      updateFields.push(`supplier_id = $${paramIndex++}`);
      updateValues.push(supplier_id);
    }

    if (upgrade_option !== undefined) {
      updateFields.push(`upgrade_option = $${paramIndex++}`);
      updateValues.push(upgrade_option);
    }

    if (cost_type !== undefined) {
      updateFields.push(`cost_type = $${paramIndex++}`);
      updateValues.push(cost_type);
    }

    if (cost !== undefined) {
      updateFields.push(`cost = $${paramIndex++}`);
      updateValues.push(cost);
    }

    if (features !== undefined) {
      updateFields.push(`features = $${paramIndex++}`);
      updateValues.push(features?.trim() || null);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description?.trim() || null);
    }

    if (units !== undefined) {
      updateFields.push(`units = $${paramIndex++}`);
      updateValues.push(units);
    }

    if (colorItemImage !== undefined) {
      updateFields.push(`color_image = $${paramIndex++}`);
      updateValues.push(colorItemImage);
    }

    if (specificationImage !== undefined) {
      updateFields.push(`specification = $${paramIndex++}`);
      updateValues.push(specificationImage);
    }

    if (status !== undefined) {
      if (typeof status !== "boolean") {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Status must be a boolean value.");
      }
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required for update.",
      );
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(color_item_id);

    const updateQuery = `
      UPDATE color_item
      SET ${updateFields.join(", ")}
      WHERE color_item_id = $${paramIndex}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);
    const updatedColorItem = keysToCamelCase(result.rows[0]);

    await client.query("COMMIT");

    return successResponse(
      res,
      updatedColorItem,
      "Color item updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Color Item Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Item code already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteColorItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { color_item_id } = req.params;

    if (!color_item_id) {
      return errorResponse(res, 400, "Color item ID is required.");
    }

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_item_id
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    await client.query(
      `
      DELETE FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Color item deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Color Item Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteImageField = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { color_item_id } = req.params;
    const { field_name } = req.body;

    if (!color_item_id) {
      return errorResponse(res, 400, "Color item ID is required.");
    }

    if (!field_name || !["color_image", "specification"].includes(field_name)) {
      return errorResponse(
        res,
        400,
        "Field name must be 'color_image' or 'specification'",
      );
    }

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_item_id
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    const updateQuery = `
      UPDATE color_item
      SET ${field_name} = NULL, updated_at = NOW()
      WHERE color_item_id = $1
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [color_item_id]);
    const updatedColorItem = keysToCamelCase(result.rows[0]);

    await client.query("COMMIT");

    return successResponse(
      res,
      updatedColorItem,
      `${field_name} deleted successfully.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Image Field Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getColorItemById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { color_item_id } = req.params;

    if (!color_item_id) {
      return errorResponse(res, 400, "Color item ID is required.");
    }

    const query = `
      SELECT *
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;

    const result = await client.query(query, [
      color_item_id,
      companyId,
      builderId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color item not found.");
    }

    const colorItem = keysToCamelCase(result.rows[0]);

    return successResponse(res, colorItem, "Color item fetched successfully.");
  } catch (error) {
    console.error("Error fetching color item:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.colorItemMove = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { color_item_id } = req.params;
    const { color_id, color_category_id } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!color_item_id) {
      return errorResponse(res, 400, "Color item ID is required.");
    }

    if (!color_id) {
      return errorResponse(res, 400, "Color ID is required.");
    }

    if (!color_category_id) {
      return errorResponse(res, 400, "Color category ID is required.");
    }

    await client.query("BEGIN");

    const colorItemCheck = await client.query(
      `
      SELECT color_item_id
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (colorItemCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    const colorCheck = await client.query(
      `
      SELECT color_id
      FROM color
      WHERE color_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_id, companyId, builderId],
    );

    if (colorCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color not found.");
    }

    const colorCategoryCheck = await client.query(
      `
      SELECT color_category_id
      FROM color_category cc
      JOIN color c ON cc.color_id = c.color_id
      WHERE cc.color_category_id = $1
        AND cc.color_id = $2
        AND (c.company_id = $3 OR c.builder_id = $4)
      `,
      [color_category_id, color_id, companyId, builderId],
    );

    if (colorCategoryCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Color category does not belong to the specified color ID or access denied.",
      );
    }

    const categoryBelongsToColorCheck = await client.query(
      `
      SELECT 1
      FROM color_category
      WHERE color_category_id = $1
        AND color_id = $2
      `,
      [color_category_id, color_id],
    );

    if (categoryBelongsToColorCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Color category ID does not belong to the specified color ID.",
      );
    }

    const existingItemCheck = await client.query(
      `
      SELECT color_item_id
      FROM color_item
      WHERE color_category_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_category_id, companyId, builderId],
    );

    if (existingItemCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Color category already contains a color item.",
      );
    }

    const ownershipCheck = await client.query(
      `
      SELECT 
        ci.color_item_id as item_exists,
        c.color_id as color_exists,
        cc.color_category_id as category_exists
      FROM color_item ci
      JOIN color c ON c.color_id = $2
      JOIN color_category cc ON cc.color_category_id = $3 AND cc.color_id = c.color_id
      WHERE ci.color_item_id = $1
        AND (ci.company_id = $4 OR ci.builder_id = $5)
        AND (c.company_id = $4 OR c.builder_id = $5)
      `,
      [color_item_id, color_id, color_category_id, companyId, builderId],
    );

    if (ownershipCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "One or more entities do not belong to your account or access denied.",
      );
    }

    const updateResult = await client.query(
      `
      UPDATE color_item
      SET color_category_id = $1, updated_at = NOW()
      WHERE color_item_id = $2
        AND (company_id = $3 OR builder_id = $4)
      RETURNING *
      `,
      [color_category_id, color_item_id, companyId, builderId],
    );

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found or access denied.");
    }

    await client.query("COMMIT");

    const updatedColorItem = keysToCamelCase(updateResult.rows[0]);
    return successResponse(
      res,
      updatedColorItem,
      "Color item moved successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Color Item Move Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
