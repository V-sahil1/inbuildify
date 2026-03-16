import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getColorItemsWithoutCategory(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { color_group_id } = req.query;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let whereClause = `WHERE (ci.company_id = $1 OR ci.builder_id = $2)
        AND ci.color_category_id IS NULL`;
    const queryParams = [companyId, builderId];
    let paramIndex = 3;

    // Add color_group_id filter if provided
    if (color_group_id) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM color_group_item_map cgim 
        WHERE cgim.color_item_id = ci.color_item_id 
        AND cgim.color_group_id = $${paramIndex}
      )`;
      queryParams.push(color_group_id);
      paramIndex++;
    }

    const sql = `
      SELECT 
        ci.color_item_id,
        ci.company_id,
        ci.builder_id,
        ci.item_name,
        ci.item_code,
        ci.supplier_id,
        ci.color_category_id,
        ci.upgrade_option,
        ci.cost_type,
        ci.cost,
        ci.features,
        ci.description,
        ci.specification_name,
        ci.units,
        ci.sort_order,
        ci.color_type_id,
        ci.range_id,
        ci.status,
        ci.color_image,
        ci.specification,
        ci.created_at,
        ci.updated_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'color_group_id', cg.color_group_id,
                'color_group_name', cg.name
              )
            )
            FROM color_group_item_map cgim_sub
            LEFT JOIN color_group cg ON cg.color_group_id = cgim_sub.color_group_id
            WHERE cgim_sub.color_item_id = ci.color_item_id
          ),
          '[]'::json
        ) AS color_groups
      FROM color_item ci
      ${whereClause}
      ORDER BY ci.created_at DESC
    `;

    const result = await client.query(sql, queryParams);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Color items without category fetched successfully",
    );
  } catch (error) {
    console.error("Get color items without category error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function createColorItem(req, res) {
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
      color_type_id,
      range_id,
      status = true,
      default_image_index,
    } = req.body;

    let finalColorTypeIds = null;
    let finalRangeIds = null;

    if (!color_category_id && (color_type_id || range_id)) {
      return errorResponse(
        res,
        400,
        "Color category ID is required when providing color type IDs or range IDs.",
      );
    }

    if (color_category_id && (color_type_id || range_id)) {
      const categoryCheck = await client.query(
        `
        SELECT cc.color_category_id
        FROM color_category cc
        JOIN color c ON cc.color_id = c.color_id
        WHERE cc.color_category_id = $1
          AND (c.company_id = $2 OR c.builder_id = $3)
        `,
        [color_category_id, companyId, builderId],
      );

      if (categoryCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid color category ID.");
      }

      if (color_type_id) {
        let colorTypeIds = color_type_id;

        if (Array.isArray(color_type_id)) {
          if (
            color_type_id.length === 1 &&
            typeof color_type_id[0] === "string"
          ) {
            try {
              const parsed = JSON.parse(color_type_id[0]);
              if (Array.isArray(parsed)) {
                colorTypeIds = parsed;
              }
            } catch (e) {}
          }
        } else if (typeof color_type_id === "string") {
          try {
            colorTypeIds = JSON.parse(color_type_id);
          } catch (e) {
            return errorResponse(res, 400, "Invalid color type ID format.");
          }
        }

        if (typeof colorTypeIds === "string") {
          return errorResponse(res, 400, "Color type IDs must be an array.");
        }

        if (!Array.isArray(colorTypeIds) || colorTypeIds.length === 0) {
          return errorResponse(
            res,
            400,
            "Color type IDs must be a non-empty array.",
          );
        }

        const colorTypeCheck = await client.query(
          `
          SELECT color_type_id
          FROM color_type
          WHERE color_type_id = ANY($1)
            AND (company_id = $2 OR builder_id = $3)
          `,
          [colorTypeIds, companyId, builderId],
        );

        const validColorTypeIds = colorTypeCheck.rows.map(
          (row) => row.color_type_id,
        );
        const invalidColorTypeIds = colorTypeIds.filter(
          (id) => !validColorTypeIds.includes(id),
        );

        if (invalidColorTypeIds.length > 0) {
          return errorResponse(
            res,
            400,
            `Invalid color type IDs: ${invalidColorTypeIds.join(", ")}`,
          );
        }
        finalColorTypeIds = colorTypeIds;
      }

      if (range_id) {
        let rangeIds = range_id;

        if (Array.isArray(range_id)) {
          if (range_id.length === 1 && typeof range_id[0] === "string") {
            try {
              const parsed = JSON.parse(range_id[0]);
              if (Array.isArray(parsed)) {
                rangeIds = parsed;
              }
            } catch (e) {}
          }
        } else if (typeof range_id === "string") {
          try {
            rangeIds = JSON.parse(range_id);
          } catch (e) {
            return errorResponse(res, 400, "Invalid range ID format.");
          }
        }

        if (typeof rangeIds === "string") {
          return errorResponse(res, 400, "Range IDs must be an array.");
        }

        if (!Array.isArray(rangeIds) || rangeIds.length === 0) {
          return errorResponse(
            res,
            400,
            "Range IDs must be a non-empty array.",
          );
        }

        const rangeCheck = await client.query(
          `
          SELECT range_id
          FROM range
          WHERE range_id = ANY($1)
            AND (company_id = $2 OR builder_id = $3)
            AND is_active = true
          `,
          [rangeIds, companyId, builderId],
        );

        const validRangeIds = rangeCheck.rows.map((row) => row.range_id);
        const invalidRangeIds = rangeIds.filter(
          (id) => !validRangeIds.includes(id),
        );

        if (invalidRangeIds.length > 0) {
          return errorResponse(
            res,
            400,
            `Invalid range IDs: ${invalidRangeIds.join(", ")}`,
          );
        }
        finalRangeIds = rangeIds;
      }
    }

    const colorImages = req.files?.colorImage || [];
    const specificationFiles = req.files?.specification || [];

    if (!item_name?.trim()) {
      return errorResponse(res, 400, "Item name is required.");
    }

    if (!item_code?.trim()) {
      return errorResponse(res, 400, "Item code is required.");
    }

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

    const specificationJson = specificationFiles.map((file) => ({
      url: file.location,
      type: file.mimetype.startsWith("image/") ? "image" : "pdf",
      originalName: file.originalname,
    }));

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

    let finalSortOrder = sort_order;

    if (color_category_id) {
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
        finalSortOrder = maxSortOrder + 1;
      } else if (sort_order <= maxSortOrder) {
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
        specification_name,
        units,
        color_image,
        specification,
        sort_order,
        color_type_id,
        range_id,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW()
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
      finalColorTypeIds,
      finalRangeIds,
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
}

export async function getAllColorItems(req, res) {
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
      color_group_id,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    const conditions = ["(ci.company_id = $1 OR ci.builder_id = $2)"];
    const values = [companyId, builderId];
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

    if (color_group_id !== undefined) {
      conditions.push(`cgim.color_group_id = $${index}`);
      values.push(color_group_id);
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
      ${color_group_id ? "LEFT JOIN color_group_item_map cgim ON ci.color_item_id = cgim.color_item_id" : ""}
      ${whereClause};
    `;

    const listQuery = `
      SELECT ci.*
      FROM color_item ci
      ${color_group_id ? "LEFT JOIN color_group_item_map cgim ON ci.color_item_id = cgim.color_item_id" : ""}
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
}

export async function updateColorItem(req, res) {
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
      color_type_id,
      range_id,
      specification_name,
      units,
      sort_order,
      status,
    } = req.body;

    let upgrade_option = reqUpgradeOption;
    const cost_type = reqCostType;
    let cost = reqCost;

    const colorImages = req.files?.colorImage || [];
    const specificationImages = req.files?.specification || [];
    const default_image_index = req.body?.default_image_index;

    if (units !== undefined) {
      if (!["mandatory", "non_mandatory", "not_required"].includes(units)) {
        return errorResponse(
          res,
          400,
          "Units must be one of: mandatory, non_mandatory, not_required",
        );
      }
    }

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

    let finalColorTypeIds = null;
    let finalRangeIds = null;

    if (!existing.color_category_id && (color_type_id || range_id)) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot update color type IDs or range IDs when color category is not assigned.",
      );
    }

    if (existing.color_category_id && (color_type_id || range_id)) {
      // Validate color_type_id array if provided
      if (color_type_id) {
        // Handle different input formats
        let colorTypeIds = color_type_id;

        if (Array.isArray(color_type_id)) {
          // Check if array contains string representation of array
          if (
            color_type_id.length === 1 &&
            typeof color_type_id[0] === "string"
          ) {
            try {
              const parsed = JSON.parse(color_type_id[0]);
              if (Array.isArray(parsed)) {
                colorTypeIds = parsed;
              }
            } catch (e) {
              // Keep original array if parsing fails
            }
          }
        } else if (typeof color_type_id === "string") {
          try {
            colorTypeIds = JSON.parse(color_type_id);
          } catch (e) {
            await client.query("ROLLBACK");
            return errorResponse(res, 400, "Invalid color type ID format.");
          }
        }

        if (typeof colorTypeIds === "string") {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "Color type IDs must be an array.");
        }

        if (!Array.isArray(colorTypeIds) || colorTypeIds.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "Color type IDs must be a non-empty array.",
          );
        }

        const colorTypeCheck = await client.query(
          `
          SELECT color_type_id
          FROM color_type
          WHERE color_type_id = ANY($1)
            AND (company_id = $2 OR builder_id = $3)
          `,
          [colorTypeIds, companyId, builderId],
        );

        const validColorTypeIds = colorTypeCheck.rows.map(
          (row) => row.color_type_id,
        );
        const invalidColorTypeIds = colorTypeIds.filter(
          (id) => !validColorTypeIds.includes(id),
        );

        if (invalidColorTypeIds.length > 0) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            `Invalid color type IDs: ${invalidColorTypeIds.join(", ")}`,
          );
        }
        finalColorTypeIds = colorTypeIds;
      }

      // Validate range_id array if provided
      if (range_id) {
        // Handle different input formats
        let rangeIds = range_id;

        if (Array.isArray(range_id)) {
          // Check if array contains string representation of array
          if (range_id.length === 1 && typeof range_id[0] === "string") {
            try {
              const parsed = JSON.parse(range_id[0]);
              if (Array.isArray(parsed)) {
                rangeIds = parsed;
              }
            } catch (e) {
              // Keep original array if parsing fails
            }
          }
        } else if (typeof range_id === "string") {
          try {
            rangeIds = JSON.parse(range_id);
          } catch (e) {
            await client.query("ROLLBACK");
            return errorResponse(res, 400, "Invalid range ID format.");
          }
        }

        if (typeof rangeIds === "string") {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "Range IDs must be an array.");
        }

        if (!Array.isArray(rangeIds) || rangeIds.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "Range IDs must be a non-empty array.",
          );
        }

        const rangeCheck = await client.query(
          `
          SELECT range_id
          FROM range
          WHERE range_id = ANY($1)
            AND (company_id = $2 OR builder_id = $3)
            AND is_active = true
          `,
          [rangeIds, companyId, builderId],
        );

        const validRangeIds = rangeCheck.rows.map((row) => row.range_id);
        const invalidRangeIds = rangeIds.filter(
          (id) => !validRangeIds.includes(id),
        );

        if (invalidRangeIds.length > 0) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            `Invalid range IDs: ${invalidRangeIds.join(", ")}`,
          );
        }
        finalRangeIds = rangeIds;
      }
    }

    if (sort_order !== undefined && !existing.color_category_id) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot update sort order when color category is not assigned.",
      );
    }

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

    if (sort_order !== undefined && existing.color_category_id) {
      const currentSortOrder = existing.sort_order;
      const newSortOrder = sort_order;
      const categoryId = existing.color_category_id;

      if (newSortOrder !== currentSortOrder) {
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

        if (newSortOrder <= maxSortOrder) {
          if (newSortOrder < currentSortOrder) {
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

    if (color_type_id !== undefined) {
      updateFields.push(`color_type_id = $${paramIndex++}`);
      updateValues.push(finalColorTypeIds);
    }

    if (range_id !== undefined) {
      updateFields.push(`range_id = $${paramIndex++}`);
      updateValues.push(finalRangeIds);
    }

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
      const defaultIndex = Number(default_image_index);

      if (isNaN(defaultIndex) || defaultIndex < 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid default image index.");
      }

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

      const updatedColorImages = existingColorImages.map((img, index) => ({
        ...img,
        is_default: index === defaultIndex,
      }));

      updateFields.push(`color_image = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updatedColorImages));
    }

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

    updateFields.push("updated_at = NOW()");

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
}

export async function deleteColorItem(req, res) {
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
}

export async function deleteImageField(req, res) {
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

    images.splice(imageIndex, 1);

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
}

export async function getColorItemById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { color_item_id } = req.params;

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
}

export async function colorItemMove(req, res) {
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

    const currentItemCheck = await client.query(
      `
      SELECT sort_order, color_category_id as current_category_id
      FROM color_item
      WHERE color_item_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (currentItemCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item not found.");
    }

    const currentItem = currentItemCheck.rows[0];

    // Check if color item has a color category - if not, user cannot move it
    if (!currentItem.current_category_id) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Color item does not have a color category assigned. Cannot move without a category.",
      );
    }

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
    const newSortOrder = maxSortOrder + 1;

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
      SET color_category_id = $1, sort_order = $2, updated_at = NOW()
      WHERE color_item_id = $3
        AND (company_id = $4 OR builder_id = $5)
      RETURNING *
      `,
      [color_category_id, newSortOrder, color_item_id, companyId, builderId],
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
}

export async function copyColorItem(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { color_item_id } = req.params;
    const { color_id, color_category_id, item_name, sort_order } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!item_name || item_name.trim() === "") {
      return errorResponse(res, 400, "Item name is required.");
    }

    await client.query("BEGIN");

    const sourceItemCheck = await client.query(
      `
      SELECT ci.*, cc.color_id as source_color_id
      FROM color_item ci
      JOIN color_category cc ON ci.color_category_id = cc.color_category_id
      WHERE ci.color_item_id = $1
        AND (ci.company_id = $2 OR ci.builder_id = $3)
      `,
      [color_item_id, companyId, builderId],
    );

    if (sourceItemCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Source color item not found.");
    }

    const sourceItem = sourceItemCheck.rows[0];

    // Check if source color item has a color category - if not, user cannot copy it
    if (!sourceItem.color_category_id) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Source color item does not have a color category assigned. Cannot copy without a category.",
      );
    }

    const targetColorCheck = await client.query(
      `
      SELECT color_id
      FROM color
      WHERE color_id = $1
        AND (company_id = $2 OR builder_id = $3)
        AND status = true
      `,
      [color_id, companyId, builderId],
    );

    if (targetColorCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Target color not found or inactive.");
    }

    const targetCategoryCheck = await client.query(
      `
      SELECT cc.color_category_id
      FROM color_category cc
      JOIN color c ON cc.color_id = c.color_id
      WHERE cc.color_category_id = $1
        AND cc.color_id = $2
        AND (c.company_id = $3 OR c.builder_id = $4)
        AND cc.status = true
      `,
      [color_category_id, color_id, companyId, builderId],
    );

    if (targetCategoryCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Target color category not found or does not belong to the specified color.",
      );
    }

    const newItemCode = `${sourceItem.item_code}_copy_${Date.now()}`;

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color_item
      WHERE (company_id = $1 OR builder_id = $2)
        AND item_code = $3
      `,
      [companyId, builderId, newItemCode],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Item code already exists.");
    }

    let finalSortOrder = sort_order;

    if (sort_order !== undefined) {
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

      if (sort_order > maxSortOrder + 1) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Sort order cannot be more than ${maxSortOrder + 1}. Current max sort order: ${maxSortOrder}`,
        );
      }

      if (sort_order <= maxSortOrder) {
        const shiftQuery = `
          UPDATE color_item
          SET sort_order = sort_order + 1
          WHERE color_category_id = $1
            AND sort_order >= $2
            AND (company_id = $3 OR builder_id = $4)
        `;
        await client.query(shiftQuery, [
          color_category_id,
          sort_order,
          companyId,
          builderId,
        ]);
      }
    } else {
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
      finalSortOrder = maxSortOrder + 1;
    }

    const copyQuery = `
      INSERT INTO color_item (
        company_id, builder_id, color_category_id, item_name, item_code,
        supplier_id, upgrade_option, cost_type, cost, features, description,
        specification_name, units, color_image, specification, sort_order,
        color_type_id, range_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const copyResult = await client.query(copyQuery, [
      companyId,
      builderId,
      color_category_id,
      item_name.trim(),
      newItemCode,
      sourceItem.supplier_id,
      sourceItem.upgrade_option,
      sourceItem.cost_type,
      sourceItem.cost,
      sourceItem.features,
      sourceItem.description,
      sourceItem.specification_name,
      sourceItem.units,
      JSON.stringify(sourceItem.color_image),
      JSON.stringify(sourceItem.specification),
      finalSortOrder,
      sourceItem.color_type_id,
      sourceItem.range_id,
      sourceItem.status,
    ]);

    if (copyResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 500, "Failed to create color item copy.");
    }

    await client.query("COMMIT");

    const copiedItem = keysToCamelCase(copyResult.rows[0]);

    return successResponse(res, copiedItem, "Color item copied successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Copy Color Item Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}
