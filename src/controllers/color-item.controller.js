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

    if (
      upgrade_option &&
      !["fixed", "start_from", "tba"].includes(upgrade_option)
    ) {
      return errorResponse(
        res,
        400,
        "Upgrade option must be one of: fixed, start_from, tba",
      );
    }

    if (cost_type && !["standard", "upgrade"].includes(cost_type)) {
      return errorResponse(
        res,
        400,
        "Cost type must be one of: standard, upgrade",
      );
    }

    if (
      units &&
      !["mandatory", "non_mandatory", "not_required"].includes(units)
    ) {
      return errorResponse(
        res,
        400,
        "Units must be one of: mandatory, non_mandatory, not_required",
      );
    }

    await client.query("BEGIN");

    // Check for duplicate item code within the same builder/company
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

    const insertQuery = `
      INSERT INTO color_item (
        company_id,
        builder_id,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
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
      upgrade_option,
      cost_type,
      cost,
      features,
      description,
      units,
      status,
    } = req.body;

    const specificationImage = req.files?.specification?.[0]?.location;
    const colorItemImage = req.files?.color_image?.[0]?.location;

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_item_id, item_code, color_image
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

    if (
      upgrade_option &&
      !["fixed", "start_from", "tba"].includes(upgrade_option)
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Upgrade option must be one of: fixed, start_from, tba",
      );
    }

    if (cost_type && !["standard", "upgrade"].includes(cost_type)) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cost type must be one of: standard, upgrade",
      );
    }

    if (
      units &&
      !["mandatory", "non_mandatory", "not_required"].includes(units)
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Units must be one of: mandatory, non_mandatory, not_required",
      );
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
