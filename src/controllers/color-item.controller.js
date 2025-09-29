const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.getAllColorItems = async (req, res) => {
  const { color_sub_category_id: colorSubCategoryId } = req.params;
  const { limit, offset } = req.query;
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const params = [req.user.builder_id, parsedLimit, parsedOffset];
    let filterClause = "";
    if (colorSubCategoryId) {
      params.push(colorSubCategoryId);
      filterClause = ` AND ci.color_sub_category_id = $4 `;
    }

    const result = await client.query(
      `SELECT ci.*
       FROM color_items ci
       JOIN color_sub_category sc ON ci.color_sub_category_id = sc.color_sub_category_id
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE ci.is_deleted = false AND cc.builder_id = $1 ${filterClause}
       ORDER BY ci.created_at DESC LIMIT $2 OFFSET $3`,
      params
    );

    const countParams = [req.user.builder_id];
    let countFilter = "";
    if (colorSubCategoryId) {
      countParams.push(colorSubCategoryId);
      countFilter = ` AND ci.color_sub_category_id = $2 `;
    }

    const totalResult = await client.query(
      `SELECT COUNT(*)
       FROM color_items ci
       JOIN color_sub_category sc ON ci.color_sub_category_id = sc.color_sub_category_id
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE ci.is_deleted = false AND cc.builder_id = $1 ${countFilter}`,
      countParams
    );

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        colorItems: keysToCamelCase(result.rows),
        pagination: { totalItems, totalPages, currentPage, limit: parsedLimit },
      },
      "Color items fetched successfully."
    );
  } catch (error) {
    return errorResponse(res, error?.statusCode || 400, error?.message || "Failed to fetch color items.");
  } finally {
    client.release();
  }
};

exports.getColorItemById = async (req, res) => {
  const { color_item_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT ci.* FROM color_items ci
       JOIN color_sub_category sc ON ci.color_sub_category_id = sc.color_sub_category_id
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE ci.color_item_id = $1 AND cc.builder_id = $2 AND ci.is_deleted = false`,
      [color_item_id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color item not found.");
    }

    return successResponse(res, keysToCamelCase(result.rows[0]), "Color item fetched successfully.");
  } catch (error) {
    console.error("Get color item by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch color item.");
  } finally {
    client.release();
  }
};

exports.createColorItem = async (req, res) => {
  const {
    colorSubCategoryId,
    name,
    code,
    standard,
    upgrade,
    units,
    notes,
    highlightNotesOnPdf,
    supplierId,
  } = req.body;
  const builderId = req.user.builder_id;
  const imageUrl = req.file?.location;

  if (!imageUrl) {
    return errorResponse(res, 400, "Image is required.");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Ensure sub-category belongs to this builder
    const parent = await client.query(
      `SELECT 1 FROM color_sub_category sc
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE sc.color_sub_category_id = $1 AND cc.builder_id = $2 AND sc.is_deleted = false`,
      [colorSubCategoryId, builderId]
    );
    if (parent.rowCount === 0) {
      return errorResponse(res, 400, "Invalid colorSubCategoryId.");
    }

    let supplierIdParam = null;
    let supplierNameParam = null;
    if (supplierId) {
      // Ensure supplier belongs to this builder
      const supplier = await client.query(
        `SELECT * FROM users WHERE users_id = $1 AND builder_id = $2 AND is_verified = true AND is_deleted = false`,
        [supplierId, builderId]
      );
      if (supplier.rowCount === 0) {
        return errorResponse(res, 400, "Invalid supplierId.");
      }
      supplierIdParam = supplier.rows[0].users_id;
      supplierNameParam = supplier.rows[0].name;
    }

    const result = await client.query(
      `INSERT INTO color_items (
        color_sub_category_id,
        builder_id,
        name,
        code,
        standard,
        upgrade,
        units,
        notes,
        highlight_notes_on_pdf,
        supplier_id,
        image
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        colorSubCategoryId,
        builderId,
        name,
        code,
        Boolean(standard) || false,
        Boolean(upgrade) || false,
        units ?? null,
        notes ?? null,
        Boolean(highlightNotesOnPdf) || false,
        supplierIdParam,
        imageUrl,
      ]
    );

    delete result.rows[0].supplier_id;
    return successResponse(res, keysToCamelCase({ ...result.rows[0], supplier: {
      supplier_id: supplierIdParam,
      name: supplierNameParam,
    } }), "Color item created successfully.");
  } catch (error) {
    console.error("Create color item error:", error);
    return errorResponse(res, 500, "Failed to create color item.");
  } finally {
    client.release();
  }
};

exports.updateColorItem = async (req, res) => {
  const { color_item_id } = req.params;
  const {
    name,
    code,
    standard,
    upgrade,
    units,
    notes,
    highlightNotesOnPdf,
    supplierId,
  } = req.body;
  const builderId = req.user.builder_id;
  let imageUrl = null;
  if (req.file) {
    imageUrl = req.file.location;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    // verify ownership of item
    const owned = await client.query(
      `SELECT ci.color_item_id, ci.image FROM color_items ci
       JOIN color_sub_category sc ON ci.color_sub_category_id = sc.color_sub_category_id
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE ci.color_item_id = $1 AND cc.builder_id = $2 AND ci.is_deleted = false`,
      [color_item_id, builderId]
    );
    if (owned.rowCount === 0) {
      return errorResponse(res, 404, "Color item not found or already deleted.");
    }

    // if supplierId is not null, verify it belongs to builder
    if (supplierId) {
      const supplier = await client.query(
        `SELECT 1 FROM users WHERE users_id = $1 AND builder_id = $2 AND is_verified = true AND is_deleted = false`,
        [supplierId, builderId]
      );
      if (supplier.rowCount === 0) {
        return errorResponse(res, 400, "Invalid supplierId.");
      }
    }

    const result = await client.query(
      `UPDATE color_items SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        standard = COALESCE($3, standard),
        upgrade = COALESCE($4, upgrade),
        units = COALESCE($5, units),
        notes = COALESCE($6, notes),
        highlight_notes_on_pdf = COALESCE($7, highlight_notes_on_pdf),
        supplier_id = COALESCE($8, supplier_id),
        image = COALESCE($9, image),
        updated_at = NOW()
       WHERE color_item_id = $10 AND is_deleted = false
       RETURNING *`,
      [
        name ?? null,
        code ?? null,
        standard ?? null,
        upgrade ?? null,
        units ?? null,
        notes ?? null,
        highlightNotesOnPdf ?? null,
        supplierId ?? owned.rows[0].supplier_id,
        imageUrl ?? owned.rows[0].image,
        color_item_id,
      ]
    );

    // after update old image delete if new image is uploaded
    if (imageUrl && owned.rows[0].image) {
      await deleteFromS3(owned.rows[0].image);
    }
    let updatedItem = null;
    if (supplierId) {
      updatedItem = await client.query(
        `SELECT name FROM users WHERE users_id = $1 AND is_deleted = false`,
        [supplierId]
      );
    }

    delete result.rows[0].supplier_id;
    return successResponse(res, {
      ...keysToCamelCase(result.rows[0]),
      supplier: {
        supplierId: supplierId ?? null,
        name: updatedItem?.rows[0].name ?? null,
      },
    }, "Color item updated successfully.");
  } catch (error) {
    console.error("Update color item error:", error);
    await deleteFromS3(imageUrl);
    return errorResponse(res, 500, "Failed to update color item.");
  } finally {
    client.release();
  }
};

exports.deleteColorItem = async (req, res) => {
  const { color_item_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const exists = await client.query(
      `SELECT ci.color_item_id FROM color_items ci
       JOIN color_sub_category sc ON ci.color_sub_category_id = sc.color_sub_category_id
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE ci.color_item_id = $1 AND cc.builder_id = $2 AND ci.is_deleted = false`,
      [color_item_id, builderId]
    );
    if (exists.rowCount === 0) {
      return errorResponse(res, 404, "Color item not found or already deleted.");
    }

    const result = await client.query(
      `UPDATE color_items SET is_deleted = true, updated_at = NOW()
       WHERE color_item_id = $1 AND is_deleted = false RETURNING *`,
      [color_item_id]
    );

    return successResponse(res, keysToCamelCase(result.rows[0]), "Color item deleted successfully.");
  } catch (error) {
    console.error("Delete color item error:", error);
    return errorResponse(res, 500, "Failed to delete color item.");
  } finally {
    client.release();
  }
};
