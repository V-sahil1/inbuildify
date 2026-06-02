import db from "../../config/database/models/postgre-models/index.js";

/**
 * Creates a new color for a builder/company, re-ordering existing colors if necessary.
 * @param {Object} userData - req.user data
 * @param {Object} colorData - req.body data
 */
export const createColorService = async (userData, colorData) => {
  const { Color } = db;
  const { Op } = db.Sequelize;
  const transaction = await db.sequelize.transaction();

  try {
    const builderId = userData?.builder_id;
    const companyId = userData?.company_id;
    const userId = userData?.users_id;

    if (!builderId || !companyId) {
      throw { status: 401, message: "Unauthorized." };
    }

    const { color_name, sort_order, status } = colorData;

    if (!color_name || color_name.trim() === "") {
      throw { status: 400, message: "Color name is required." };
    }

    const finalSortOrder = sort_order || 1;

    // 1. Shift existing colors' sort_order
    await Color.increment(
      { sort_order: 1 },
      {
        where: {
          company_id: companyId,
          builder_id: builderId,
          sort_order: { [Op.gte]: finalSortOrder },
        },
        transaction,
      },
    );

    // 2. Duplicate Check (Case-insensitive)
    const duplicate = await Color.findOne({
      where: {
        company_id: companyId,
        builder_id: builderId,
        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn("LOWER", db.sequelize.col("color_name")),
            Op.eq,
            color_name.trim().toLowerCase(),
          ),
        ],
      },
      transaction,
    });

    if (duplicate) {
      throw { status: 409, message: "Color with this name already exists." };
    }

    // 3. Insert New Color
    const newColor = await Color.create(
      {
        company_id: companyId,
        builder_id: builderId,
        color_name: color_name.trim(),
        sort_order: finalSortOrder,
        status: status !== undefined ? status : true,
        created_by: userId,
        updated_by: userId,
      },
      { transaction },
    );

    await transaction.commit();

    return newColor.get({ plain: true });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Fetches colors for a builder/company with pagination.
 * @param {Object} userData - req.user data
 * @param {Object} queryData - req.query data (page, limit)
 */
export const getColorsService = async (userData, queryData) => {
  const { Color } = db;
  const builderId = userData?.builder_id;
  const companyId = userData?.company_id;

  if (!builderId || !companyId) {
    throw { status: 401, message: "Unauthorized." };
  }

  const page = parseInt(queryData.page) || 1;
  const limit = parseInt(queryData.limit) || 10;
  const offset = (page - 1) * limit;

  const { count, rows } = await Color.findAndCountAll({
    where: {
      company_id: companyId,
      builder_id: builderId,
    },
    attributes: [
      "color_id",
      "company_id",
      "builder_id",
      "color_name",
      "sort_order",
      "status",
      "created_at",
      "updated_at",
    ],
    order: [
      ["sort_order", "ASC"],
      ["created_at", "ASC"],
    ],
    limit,
    offset,
  });

  const totalPages = Math.ceil(count / limit);

  return {
    colors: rows.map((r) => r.get({ plain: true })),
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords: count,
      limit,
    },
  };
};

/**
 * Updates an existing color, re-balancing sort orders if necessary.
 * @param {Object} userData - req.user data
 * @param {string} colorId - ID of the color to update
 * @param {Object} colorData - req.body data
 */
export const updateColorService = async (userData, colorId, colorData) => {
  const { Color } = db;
  const { Op } = db.Sequelize;
  const transaction = await db.sequelize.transaction();

  try {
    const builderId = userData?.builder_id;
    const companyId = userData?.company_id;
    const userId = userData?.users_id;

    const { color_name, sort_order, status } = colorData;

    // 1. Check Existence
    const existingColor = await Color.findOne({
      where: {
        color_id: colorId,
        builder_id: builderId,
        company_id: companyId,
      },
      transaction,
    });

    if (!existingColor) {
      throw { status: 404, message: "Color not found." };
    }

    // 2. Sort Order Shifting
    if (sort_order !== undefined && sort_order !== existingColor.sort_order) {
      if (sort_order > existingColor.sort_order) {
        // Moving down: decrement colors in between
        await Color.decrement(
          { sort_order: 1 },
          {
            where: {
              company_id: companyId,
              builder_id: builderId,
              sort_order: {
                [Op.gt]: existingColor.sort_order,
                [Op.lte]: sort_order,
              },
              color_id: { [Op.ne]: colorId },
            },
            transaction,
          },
        );
      } else {
        // Moving up: increment colors in between
        await Color.increment(
          { sort_order: 1 },
          {
            where: {
              company_id: companyId,
              builder_id: builderId,
              sort_order: {
                [Op.gte]: sort_order,
                [Op.lt]: existingColor.sort_order,
              },
              color_id: { [Op.ne]: colorId },
            },
            transaction,
          },
        );
      }
    }

    // 3. Prepare Update Data
    const updateData = {};
    if (color_name !== undefined) {
      updateData.color_name = color_name;
    }
    if (sort_order !== undefined) {
      updateData.sort_order = sort_order;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    updateData.updated_by = userId;

    // Logic from original: At least one field (besides updated_by) must be provided
    if (Object.keys(updateData).length <= 1) {
      throw { status: 400, message: "At least one field must be provided for update." };
    }

    // 4. Perform Update
    await existingColor.update(updateData, { transaction });

    await transaction.commit();

    return existingColor.get({ plain: true });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Deletes an existing color and re-balances sort orders of remaining colors.
 * @param {Object} userData - req.user data
 * @param {string} colorId - ID of the color to delete
 */
export const deleteColorService = async (userData, colorId) => {
  const { Color } = db;
  const { Op } = db.Sequelize;
  const transaction = await db.sequelize.transaction();

  try {
    const builderId = userData?.builder_id;
    const companyId = userData?.company_id;

    if (!builderId || !companyId) {
      throw { status: 401, message: "Unauthorized." };
    }

    // 1. Check Existence
    const existingColor = await Color.findOne({
      where: {
        color_id: colorId,
        builder_id: builderId,
        company_id: companyId,
      },
      transaction,
    });

    if (!existingColor) {
      throw { status: 404, message: "Color not found." };
    }

    // 2. Cascade Delete Orchestration
    const categories = await db.ColorCategory.findAll({
      where: { color_id: colorId },
      attributes: ["color_category_id"],
      transaction,
    });

    const categoryIds = categories.map((c) => c.color_category_id);

    if (categoryIds.length > 0) {
      // Find all color items for these categories
      const items = await db.ColorItem.findAll({
        where: { color_category_id: { [Op.in]: categoryIds } },
        attributes: ["color_item_id"],
        transaction,
      });

      const itemIds = items.map((i) => i.color_item_id);

      if (itemIds.length > 0) {
        // Delete mappings and custom fields for these items
        await db.ColorGroupItemMap.destroy({
          where: { color_item_id: { [Op.in]: itemIds } },
          transaction,
        });

        await db.ColorItemCustomField.destroy({
          where: { color_item: { [Op.in]: itemIds } },
          transaction,
        });

        // Delete the items themselves
        await db.ColorItem.destroy({
          where: { color_item_id: { [Op.in]: itemIds } },
          transaction,
        });
      }

      // Delete sub-categories for these categories
      await db.ColorSubCategory.destroy({
        where: { color_category_id: { [Op.in]: categoryIds } },
        transaction,
      });

      // Delete the categories themselves
      await db.ColorCategory.destroy({
        where: { color_id: colorId },
        transaction,
      });
    }

    // 3. Sort Order Shifting (Decrement all colors after this one)
    await Color.decrement(
      { sort_order: 1 },
      {
        where: {
          company_id: companyId,
          builder_id: builderId,
          sort_order: { [Op.gt]: existingColor.sort_order },
        },
        transaction,
      },
    );

    // 3. Delete the Color
    await existingColor.destroy({ transaction });

    await transaction.commit();

    return existingColor.get({ plain: true });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Fetches a single color by ID after verifying ownership.
 * @param {Object} userData - req.user data
 * @param {string} colorId - ID of the color to fetch
 */
export const getColorByIdService = async (userData, colorId) => {
  const { Color } = db;
  const builderId = userData?.builder_id;
  const companyId = userData?.company_id;

  if (!builderId || !companyId) {
    throw { status: 401, message: "Unauthorized." };
  }

  const color = await Color.findOne({
    where: {
      color_id: colorId,
      builder_id: builderId,
      company_id: companyId,
    },
  });

  if (!color) {
    throw { status: 404, message: "Color not found." };
  }

  return color.get({ plain: true });
};

/**
 * Copies a color with all its categories, items, and custom fields.
 * Performs sort rebalancing and uniqueness checks.
 */
export const copyColorService = async (userData, colorId, bodyData) => {
  const { Color, ColorCategory, ColorItem, ColorItemCustomField } = db;
  const { Op } = db.Sequelize;
  const transaction = await db.sequelize.transaction();

  try {
    const builderId = userData?.builder_id;
    const companyId = userData?.company_id;
    const userId = userData?.users_id;
    const { color_name, sort_order } = bodyData;

    if (!builderId || !companyId) {
      throw { status: 401, message: "Unauthorized." };
    }

    if (!colorId) {
      throw { status: 400, message: "Color ID is required." };
    }

    if (!color_name || color_name.trim() === "") {
      throw { status: 400, message: "Color name is required." };
    }

    // 1. Fetch Source Color
    const sourceColor = await Color.findOne({
      where: {
        color_id: colorId,
        [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
      },
      transaction,
    });

    if (!sourceColor) {
      throw { status: 404, message: "Source color not found." };
    }

    // 2. Duplicate Check
    const duplicate = await Color.findOne({
      where: {
        company_id: companyId,
        builder_id: builderId,
        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn("LOWER", db.sequelize.col("color_name")),
            Op.eq,
            color_name.trim().toLowerCase(),
          ),
        ],
      },
      transaction,
    });

    if (duplicate) {
      throw { status: 409, message: "Color with this name already exists." };
    }

    // 3. Sort Order Calculation
    const totalColors = await Color.count({
      where: {
        [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
      },
      transaction,
    });

    const maxAllowedSortOrder = totalColors + 1;

    if (sort_order && sort_order > maxAllowedSortOrder) {
      throw {
        status: 400,
        message: `Sort order cannot be more than ${maxAllowedSortOrder}. Current total colors: ${totalColors}`,
      };
    }

    const finalSortOrder = sort_order || maxAllowedSortOrder;

    // 4. Shift Colors
    await Color.increment(
      { sort_order: 1 },
      {
        where: {
          company_id: companyId,
          builder_id: builderId,
          sort_order: { [Op.gte]: finalSortOrder },
        },
        transaction,
      },
    );

    // 5. Create New Color
    const newColor = await Color.create(
      {
        company_id: companyId,
        builder_id: builderId,
        color_name: color_name.trim(),
        sort_order: finalSortOrder,
        status: true,
        created_by: userId,
        updated_by: userId,
      },
      { transaction },
    );

    const newColorId = newColor.color_id;

    // 6. Copy Categories
    const categories = await ColorCategory.findAll({
      where: { color_id: colorId },
      order: [["sort_order", "ASC"]],
      transaction,
    });

    const categoryMapping = {}; // Old Category ID -> New Category Record

    for (const category of categories) {
      const categoryData = category.get({ plain: true });
      delete categoryData.color_category_id;
      categoryData.color_id = newColorId;
      categoryData.created_by = userId;
      categoryData.updated_by = userId;
      categoryData.createdAt = new Date();
      categoryData.updatedAt = new Date();

      const newCategory = await ColorCategory.create(categoryData, { transaction });
      categoryMapping[category.color_category_id] = newCategory.color_category_id;
    }

    // 7. Copy Items
    const sourceCategoryIds = Object.keys(categoryMapping);
    if (sourceCategoryIds.length > 0) {
      const items = await ColorItem.findAll({
        where: { color_category_id: { [Op.in]: sourceCategoryIds } },
        transaction,
      });

      for (const item of items) {
        const itemData = item.get({ plain: true });
        const oldItemId = itemData.color_item_id;
        delete itemData.color_item_id;

        itemData.color_category_id = categoryMapping[itemData.color_category_id];
        itemData.company_id = companyId;
        itemData.builder_id = builderId;
        // Logic from original: creation date and status parity
        itemData.createdAt = new Date();
        itemData.updatedAt = new Date();

        const newItem = await ColorItem.create(itemData, { transaction });
        const newColorItemId = newItem.color_item_id;

        // 8. Copy Custom Fields for this item
        const customFields = await ColorItemCustomField.findAll({
          where: { color_item: oldItemId },
          order: [["sort_order", "ASC"]],
          transaction,
        });

        for (const customField of customFields) {
          const fieldData = customField.get({ plain: true });
          delete fieldData.color_item_custom_field_id;
          fieldData.color_item = newColorItemId;
          fieldData.createdAt = new Date();
          fieldData.updatedAt = new Date();

          await ColorItemCustomField.create(fieldData, { transaction });
        }
      }
    }

    await transaction.commit();
    return newColor.get({ plain: true });

  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    throw error;
  }
};

export default {
  createColorService,
  getColorsService,
  updateColorService,
  deleteColorService,
  getColorByIdService,
  copyColorService,
};
