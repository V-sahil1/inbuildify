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
      specification_name,
      units = "non_mandatory",
      sort_order,
      status = true,
      default_image_index,
    } = req.body;

    const colorImages = req.files?.colorImage || [];
    const specificationFiles = req.files?.specification || [];

    /* ---------- BASIC VALIDATION ---------- */
    if (!item_name?.trim()) {
      return errorResponse(res, 400, "Item name is required.");
    }

    if (!item_code?.trim()) {
      return errorResponse(res, 400, "Item code is required.");
    }

    /* ---------- COST VALIDATION (UNCHANGED) ---------- */
    if (cost_type === "standard") {
      if (upgrade_option || cost) {
        return errorResponse(
          res,
          400,
          "Upgrade option or cost cannot be set when cost type is standard.",
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

    /* ---------- DEFAULT IMAGE LOGIC (FIXED) ---------- */
    const hasDefaultIndex =
      default_image_index !== undefined && default_image_index !== "";
    const defaultIndex = hasDefaultIndex ? Number(default_image_index) : null;
    if (
      hasDefaultIndex &&
      (isNaN(defaultIndex) ||
        defaultIndex < 0 ||
        defaultIndex >= colorImages.length)
    ) {
      return errorResponse(res, 400, "Invalid default image index.");
    }

    const colorImageJson = colorImages.map((file, index) => ({
      url: file.location,
      is_default: hasDefaultIndex && index === defaultIndex,
    }));

    /* ---------- SPECIFICATION FILES (IMAGES + PDFS) ---------- */
    const specificationJson = specificationFiles.map((file) => ({
      url: file.location,
      type: file.mimetype.startsWith("image/") ? "image" : "pdf",
      originalName: file.originalname,
    }));

    await client.query("BEGIN");

    /* ---------- DUPLICATE ITEM CODE ---------- */
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

    // Handle sort order shifting
    let finalSortOrder = sort_order;

    if (color_category_id) {
      // If color_category_id is provided, check for existing items in that category
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) as max_sort_order
        FROM color_item
        WHERE color_category_id = $1
          AND (company_id = $2 OR builder_id = $3)
      `;
      const maxSortResult = await client.query(maxSortOrderQuery, [
        color_category_id,
        companyId,
        builderId,
      ]);

      const maxSortOrder = parseInt(maxSortResult.rows[0].max_sort_order) || 0;

      if (!sort_order) {
        // If no sort_order provided, place at the end
        finalSortOrder = maxSortOrder + 1;
      } else if (sort_order <= maxSortOrder) {
        // If sort_order is within existing range, shift existing items
        const shiftQuery = `
          UPDATE color_item 
          SET sort_order = sort_order + 1 
          WHERE color_category_id = $1
            AND (company_id = $2 OR builder_id = $3)
            AND sort_order >= $4
        `;
        await client.query(shiftQuery, [
          color_category_id,
          companyId,
          builderId,
          sort_order,
        ]);
      }
      // If sort_order > maxSortOrder, it's already at the correct position
    }

    /* ---------- INSERT ---------- */
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
        specification_name,
        units,
        color_image,
        specification,
        sort_order,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,NOW(),NOW()
      )
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
      specification_name?.trim() || null,
      units,
      JSON.stringify(colorImageJson),
      JSON.stringify(specificationJson),
      finalSortOrder,
      status,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color item created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Color Item Error:", error);
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
      cost_type,
      upgrade_option,
      units,
      color_category_id,
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

    if (cost_type !== undefined) {
      if (!["standard", "upgrade"].includes(cost_type)) {
        return errorResponse(res, 400, "cost_type must be standard or upgrade");
      }
      conditions.push(`ci.cost_type = $${index}`);
      values.push(cost_type);
      index++;
    }

    if (upgrade_option !== undefined) {
      if (!["fixed", "start_from", "tba"].includes(upgrade_option)) {
        return errorResponse(
          res,
          400,
          "upgrade_option must be fixed, start_from, or tba",
        );
      }
      conditions.push(`ci.upgrade_option = $${index}`);
      values.push(upgrade_option);
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

    if (color_category_id !== undefined) {
      conditions.push(`ci.color_category_id = $${index}`);
      values.push(color_category_id);
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
      specification_name,
      units,
      sort_order,
      status,
    } = req.body;

    let upgrade_option = reqUpgradeOption;
    let cost_type = reqCostType;
    let cost = reqCost;

    const colorImages = req.files?.colorImage || [];
    const specificationImages = req.files?.specification || [];
    const default_image_index = req.body?.default_image_index;

    /* ---------- UNITS VALIDATION ---------- */
    if (units !== undefined) {
      if (!["mandatory", "non_mandatory", "not_required"].includes(units)) {
        return errorResponse(
          res,
          400,
          "Units must be one of: mandatory, non_mandatory, not_required",
        );
      }
    }

    /* ---------- COST VALIDATION ---------- */
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

    await client.query("BEGIN");

    /* ---------- EXISTING RECORD CHECK ---------- */
    const existingCheck = await client.query(
      `
      SELECT color_item_id, item_code, color_image, cost_type, upgrade_option, cost, sort_order, color_category_id
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

    /* ---------- SORT ORDER VALIDATION ---------- */
    if (sort_order !== undefined && !existing.color_category_id) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot update sort order when color category is not assigned.",
      );
    }

    /* ---------- COST TYPE SPECIFIC VALIDATION ---------- */
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

    /* ---------- DUPLICATE ITEM CODE CHECK ---------- */
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

    /* ---------- SUPPLIER VALIDATION ---------- */
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

    /* ---------- SORT ORDER SHIFTING LOGIC ---------- */
    if (sort_order !== undefined && existing.color_category_id) {
      const currentSortOrder = existing.sort_order;
      const newSortOrder = sort_order;
      const categoryId = existing.color_category_id;

      if (newSortOrder !== currentSortOrder) {
        // Get max sort order in the category
        const maxSortOrderQuery = `
          SELECT COALESCE(MAX(sort_order), 0) as max_sort_order
          FROM color_item
          WHERE color_category_id = $1
            AND (company_id = $2 OR builder_id = $3)
            AND color_item_id != $4
        `;
        const maxSortResult = await client.query(maxSortOrderQuery, [
          categoryId,
          companyId,
          builderId,
          color_item_id,
        ]);

        const maxSortOrder =
          parseInt(maxSortResult.rows[0].max_sort_order) || 0;

        // If new sort order is within valid range, shift items
        if (newSortOrder <= maxSortOrder) {
          if (newSortOrder < currentSortOrder) {
            // Moving up: shift items between new and current position down by 1
            const shiftUpQuery = `
              UPDATE color_item 
              SET sort_order = sort_order + 1 
              WHERE color_category_id = $1
                AND (company_id = $2 OR builder_id = $3)
                AND color_item_id != $4
                AND sort_order >= $5
                AND sort_order < $6
            `;
            await client.query(shiftUpQuery, [
              categoryId,
              companyId,
              builderId,
              color_item_id,
              newSortOrder,
              currentSortOrder,
            ]);
          } else {
            // Moving down: shift items between current and new position up by 1
            const shiftDownQuery = `
              UPDATE color_item 
              SET sort_order = sort_order - 1 
              WHERE color_category_id = $1
                AND (company_id = $2 OR builder_id = $3)
                AND color_item_id != $4
                AND sort_order > $5
                AND sort_order <= $6
            `;
            await client.query(shiftDownQuery, [
              categoryId,
              companyId,
              builderId,
              color_item_id,
              currentSortOrder,
              newSortOrder,
            ]);
          }
        }
        // If new sort order > max, it's already at correct position
      }
    }

    /* ---------- BUILD UPDATE FIELDS ---------- */
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

    if (specification_name !== undefined) {
      updateFields.push(`specification_name = $${paramIndex++}`);
      updateValues.push(specification_name?.trim() || null);
    }

    if (units !== undefined) {
      updateFields.push(`units = $${paramIndex++}`);
      updateValues.push(units);
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramIndex++}`);
      updateValues.push(sort_order);
    }

    /* ---------- HANDLE COLOR IMAGES ---------- */
    if (colorImages.length > 0) {
      const hasDefaultIndex =
        default_image_index !== undefined && default_image_index !== "";

      const defaultIndex = hasDefaultIndex ? Number(default_image_index) : null;

      if (
        hasDefaultIndex &&
        (isNaN(defaultIndex) ||
          defaultIndex < 0 ||
          defaultIndex >= colorImages.length)
      ) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid default image index.");
      }

      const colorImageJson = colorImages.map((file, index) => ({
        url: file.location,
        is_default: hasDefaultIndex && index === defaultIndex,
      }));

      updateFields.push(`color_image = $${paramIndex++}`);
      updateValues.push(JSON.stringify(colorImageJson));
    } else if (
      default_image_index !== undefined &&
      default_image_index !== ""
    ) {
      // Handle updating only the default image index without new images
      const defaultIndex = Number(default_image_index);

      if (isNaN(defaultIndex) || defaultIndex < 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid default image index.");
      }

      // Get existing color images
      let existingColorImages = [];
      if (existing.color_image) {
        try {
          existingColorImages =
            typeof existing.color_image === "string"
              ? JSON.parse(existing.color_image)
              : existing.color_image;
        } catch (error) {
          await client.query("ROLLBACK");
          return errorResponse(res, 500, "Invalid existing color image data.");
        }
      }

      if (defaultIndex >= existingColorImages.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Default image index out of range.");
      }

      // Update the default flag
      const updatedColorImages = existingColorImages.map((img, index) => ({
        ...img,
        is_default: index === defaultIndex,
      }));

      updateFields.push(`color_image = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updatedColorImages));
    }

    /* ---------- HANDLE SPECIFICATION IMAGES ---------- */
    if (specificationImages.length > 0) {
      const specificationJson = specificationImages.map((file) => ({
        url: file.location,
      }));

      updateFields.push(`specification = $${paramIndex++}`);
      updateValues.push(JSON.stringify(specificationJson));
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
        AND (company_id = $${paramIndex + 1} OR builder_id = $${paramIndex + 2})
      RETURNING *;
    `;

    updateValues.push(companyId, builderId);

    const result = await client.query(updateQuery, updateValues);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found or access denied.");
    }

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

    // Get sort order and color_category_id of item being deleted
    const sortOrderQuery = `
      SELECT sort_order, color_category_id
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;
    const sortOrderResult = await client.query(sortOrderQuery, [
      color_item_id,
      companyId,
      builderId,
    ]);

    if (sortOrderResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    const deletedSortOrder = sortOrderResult.rows[0].sort_order;
    const deletedCategoryId = sortOrderResult.rows[0].color_category_id;

    // Shift up all items with sort_order > deletedSortOrder
    const shiftQuery = `
      UPDATE color_item 
      SET sort_order = sort_order - 1 
      WHERE color_category_id = $1
        AND (company_id = $2 OR builder_id = $3)
        AND sort_order > $4
    `;
    await client.query(shiftQuery, [
      deletedCategoryId,
      companyId,
      builderId,
      deletedSortOrder,
    ]);

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
    const { field_name, index } = req.body;

    if (!color_item_id) {
      return errorResponse(res, 400, "Color item ID is required.");
    }

    if (!field_name || !["color_image", "specification"].includes(field_name)) {
      return errorResponse(
        res,
        400,
        "Field name must be 'color_image' or 'specification'.",
      );
    }

    if (index === undefined || index === null || isNaN(Number(index))) {
      return errorResponse(res, 400, "Valid index is required.");
    }

    const imageIndex = Number(index);

    await client.query("BEGIN");

    /* ---------- FETCH ITEM ---------- */
    const existingResult = await client.query(
      `
      SELECT ${field_name}
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    let images = existingResult.rows[0][field_name] || [];

    if (!Array.isArray(images)) {
      images = [];
    }

    if (imageIndex < 0 || imageIndex >= images.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid image index.");
    }

    /* ---------- REMOVE IMAGE ---------- */
    images.splice(imageIndex, 1);

    /* ❗ NO DEFAULT RE-ASSIGNMENT HERE ❗ */

    /* ---------- UPDATE DB ---------- */
    const updateQuery = `
      UPDATE color_item
      SET ${field_name} = $1, updated_at = NOW()
      WHERE color_item_id = $2
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      JSON.stringify(images),
      color_item_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Image deleted successfully.",
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
      return successResponse(res, [], "Color item fetched successfully.");
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
