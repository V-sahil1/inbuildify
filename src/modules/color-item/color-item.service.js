import { Op } from "sequelize";
import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase, keysToSnakeCase } from "../../utils/common.js";

/**
 * Common includes for color item retrieval
 */
const getColorItemIncludes = () => {
  const { ColorCategory, Color, ColorGroupItemMap, ColorGroup, ColorItemCustomField } = db;
  return [
    {
      model: ColorCategory,
      as: "colorCategory",
      attributes: ["color_category_id", "category_name"],
      include: [
        {
          model: Color,
          as: "color",
          attributes: ["color_id", "color_name"],
        },
      ],
    },
    {
      model: ColorGroupItemMap,
      as: "colorGroupItemMaps",
      include: [
        {
          model: ColorGroup,
          as: "colorGroup",
          attributes: ["color_group_id", "name"],
        },
      ],
    },
    {
      model: ColorItemCustomField,
      as: "customFields",
      attributes: [
        "color_item_custom_field_id",
        "field_type",
        "field_name",
        "required_field",
        "sort_order",
      ],
    },
  ];
};

/**
 * Transformation utility to match the complex legacy SQL JSON structure
 */
const transformColorItem = (item) => {
  const plainItem = item.get({ plain: true });
  const transformed = {
    ...keysToCamelCase(plainItem),
    colorCategory: plainItem.colorCategory
      ? {
          id: plainItem.colorCategory.color_category_id,
          name: plainItem.colorCategory.category_name,
        }
      : null,
    color: plainItem.colorCategory?.color
      ? {
          id: plainItem.colorCategory.color.color_id,
          name: plainItem.colorCategory.color.color_name,
        }
      : null,
    colorGroups: (plainItem.colorGroupItemMaps || []).map((map) => ({
      colorGroupId: map.color_group_id,
      colorGroupName: map.colorGroup?.name || null,
    })),
    customFields: (plainItem.customFields || []).map((cf) =>
      keysToCamelCase(cf),
    ),
  };

  // Remove internal association keys
  delete transformed.colorGroupItemMaps;

  return transformed;
};

export async function getColorItemsWithoutCategoryService({ builderId, companyId, colorGroupId }) {
  const { ColorItem, ColorGroupItemMap } = db;

  const where = {
    [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
    color_category_id: null,
  };

  const include = getColorItemIncludes();

  if (colorGroupId) {
    include.push({
      model: ColorGroupItemMap,
      as: "filteringGroupMap",
      where: { color_group_id: colorGroupId },
      required: true,
      attributes: [],
    });
  }

  const items = await ColorItem.findAll({
    where,
    include,
    order: [["created_at", "DESC"]],
  });

  return items.map(transformColorItem);
}

export async function getAllColorItemsService({
  builderId,
  companyId,
  page,
  limit,
  status,
  search,
  costType,
  upgradeOption,
  units,
  colorCategoryId,
  colorGroupId,
}) {
  const { ColorItem, ColorGroupItemMap, ColorItemCustomField } = db;

  const where = {
    [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
  };

  if (status !== undefined) where.status = status === "true";
  if (costType) where.cost_type = costType;
  if (upgradeOption) where.upgrade_option = upgradeOption;
  if (units) where.units = units;
  if (colorCategoryId) where.color_category_id = colorCategoryId;

  if (search?.trim()) {
    where[Op.or] = [
      { item_name: { [Op.iLike]: `%${search.trim()}%` } },
      { item_code: { [Op.iLike]: `%${search.trim()}%` } },
    ];
  }

  const include = [
    {
      model: ColorItemCustomField,
      as: "customFields",
      attributes: [
        ["color_item_custom_field_id", "color_item_custom_field_id"],
        "field_type",
        "field_name",
        "required_field",
        "sort_order",
      ],
    },
  ];

  if (colorGroupId) {
    include.push({
      model: ColorGroupItemMap,
      as: "filteringGroupMap",
      where: { color_group_id: colorGroupId },
      required: true,
      attributes: [],
    });
  }

  const { rows, count } = await ColorItem.findAndCountAll({
    where,
    include,
    distinct: true,
    order: [["created_at", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  const transformedRows = rows.map((item) => {
    const plain = item.get({ plain: true });
    const result = {
      ...keysToCamelCase(plain),
      customFields: (plain.customFields || []).map((item) => keysToCamelCase(item)),
    };
    return result;
  });

  return {
    rows: transformedRows,
    total: count,
  };
}

export async function getColorItemByIdService({ colorItemId, companyId, builderId }) {
  const { ColorItem, ColorItemCustomField } = db;

  const item = await ColorItem.findOne({
    where: {
      color_item_id: colorItemId,
      [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
    },
    include: [
      {
        model: ColorItemCustomField,
        as: "customFields",
      },
    ],
  });

  if (!item) return null;

  const plain = item.get({ plain: true });
  const result = {
    ...keysToCamelCase(plain),
    customFields: (plain.customFields || []).map((cf) => keysToCamelCase(cf)),
  };

  return result;
}

export async function createColorItemService(data, user) {
  const {
    item_name,
    item_code,
    supplier_id,
    color_category_id,
    upgrade_option,
    cost_type,
    cost,
    features,
    description,
    specification_name,
    units,
    sort_order,
    finalColorTypeIds,
    finalRangeIds,
    status,
    colorImageJson,
    specificationJson,
    parsedCustomFields,
    color_id,
    color_group_id,
  } = data;

  const { company_id: companyId, builder_id: builderId } = user;
  const { ColorItem, ColorCategory, ColorType, Range, Supplier, ColorItemCustomField, Color, ColorGroup, ColorGroupItemMap } = db;

  const transaction = await db.sequelize.transaction();

  try {
    let resolvedColorId = color_id;
    if (color_category_id) {
      const category = await ColorCategory.findOne({
        where: { color_category_id },
        include: [{ model: Color, as: "color", where: { [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, required: true }],
        transaction,
      });

      if (!category) throw { statusCode: 400, message: "Invalid color category ID." };
      if (!resolvedColorId) resolvedColorId = category.color_id;
    }

    if (finalColorTypeIds?.length > 0) {
      const count = await ColorType.count({ where: { color_type_id: { [Op.in]: finalColorTypeIds }, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction });
      if (count !== finalColorTypeIds.length) throw { statusCode: 400, message: "Invalid color type IDs." };
    }

    const duplicate = await ColorItem.findOne({ where: { item_code: item_code.trim(), [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction });
    if (duplicate) throw { statusCode: 409, message: "Item code already exists." };

    let finalSortOrder = sort_order || null;
    if (color_category_id) {
      const maxSort = (await ColorItem.max("sort_order", { where: { color_category_id, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction })) || 0;
      if (!sort_order) finalSortOrder = maxSort + 1;
      else if (sort_order <= maxSort) {
        await ColorItem.increment("sort_order", { by: 1, where: { color_category_id, sort_order: { [Op.gte]: sort_order }, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction });
      }
    }

    const colorItem = await ColorItem.create({
      company_id: companyId,
      builder_id: builderId,
      color_id: resolvedColorId || null,
      color_category_id: color_category_id || null,
      item_name: item_name.trim(),
      item_code: item_code.trim(),
      supplier_id: supplier_id || null,
      upgrade_option: upgrade_option || null,
      cost_type,
      cost: cost || null,
      features: features?.trim() || null,
      description: description?.trim() || null,
      specification_name: specification_name?.trim() || null,
      units,
      color_image: colorImageJson,
      specification: specificationJson,
      sort_order: finalSortOrder,
      color_type_id: finalColorTypeIds,
      range_id: finalRangeIds,
      status,
    }, { transaction });

    if (parsedCustomFields?.length > 0) {
      await ColorItemCustomField.bulkCreate(parsedCustomFields.map(f => ({ ...f, color_item: colorItem.color_item_id })), { transaction });
    }

    if (color_group_id) {
      await ColorGroupItemMap.create({ color_group_id, color_item_id: colorItem.color_item_id }, { transaction });
    }

    await transaction.commit();
    return transformColorItem(await ColorItem.findByPk(colorItem.color_item_id, { include: getColorItemIncludes() }));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateColorItemService({ builderId, companyId, colorItemId, data }) {
  const { ColorItem } = db;
  const transaction = await db.sequelize.transaction();

  try {
    const item = await ColorItem.findOne({
      where: { color_item_id: colorItemId, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] },
      transaction,
    });

    if (!item) throw { status: 404, message: "Color item not found." };

    if (data.item_code && data.item_code.trim() !== item.item_code) {
      const duplicate = await ColorItem.findOne({
        where: { item_code: data.item_code.trim(), color_item_id: { [Op.ne]: colorItemId }, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] },
        transaction,
      });
      if (duplicate) throw { status: 409, message: "Item code already exists." };
    }

    const updateData = { ...keysToSnakeCase(data) };
    
    // Handle images and specifications merging if provided
    if (data.colorImages) {
      const currentImages = item.color_image || [];
      const newImages = data.colorImages.map((img, idx) => ({
        ...img,
        is_default: data.default_image_index !== undefined ? idx === Number(data.default_image_index) : false
      }));
      updateData.color_image = [...currentImages, ...newImages];
    } else if (data.default_image_index !== undefined) {
      const images = (item.color_image || []).map((img, idx) => ({
        ...img,
        is_default: idx === Number(data.default_image_index)
      }));
      updateData.color_image = images;
    }

    if (data.specificationImages) {
      updateData.specification = [...(item.specification || []), ...data.specificationImages];
    }

    await item.update(updateData, { transaction });
    await transaction.commit();
    
    return transformColorItem(await ColorItem.findByPk(colorItemId, { include: getColorItemIncludes() }));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function deleteColorItemService({ builderId, companyId, colorItemId }) {
  const { ColorItem } = db;
  const transaction = await db.sequelize.transaction();

  try {
    const item = await ColorItem.findOne({
      where: { color_item_id: colorItemId, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] },
      transaction,
    });

    if (!item) throw { status: 404, message: "Color item not found." };

    const { color_category_id, sort_order } = item;
    await item.destroy({ transaction });

    if (color_category_id && sort_order) {
      await ColorItem.decrement("sort_order", {
        by: 1,
        where: { color_category_id, sort_order: { [Op.gt]: sort_order }, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] },
        transaction,
      });
    }

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function deleteImageFieldService({ builderId, companyId, colorItemId, fieldName, index }) {
  const { ColorItem } = db;
  const item = await ColorItem.findOne({ where: { color_item_id: colorItemId, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] } });
  if (!item) throw { status: 404, message: "Color item not found." };

  const dbField = fieldName === "colorImage" ? "color_image" : "specification";
  const list = item[dbField] || [];
  if (index < 0 || index >= list.length) throw { status: 400, message: "Invalid image index." };

  list.splice(index, 1);
  await item.update({ [dbField]: list });
  return transformColorItem(await ColorItem.findByPk(colorItemId, { include: getColorItemIncludes() }));
}

export async function colorItemMoveService({ builderId, companyId, colorItemId, data }) {
  const { ColorItem } = db;
  const { target_category_id } = data;
  
  const transaction = await db.sequelize.transaction();
  try {
    const item = await ColorItem.findOne({ where: { color_item_id: colorItemId, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction });
    if (!item) throw { status: 404, message: "Color item not found." };

    const oldCategory = item.color_category_id;
    const oldSort = item.sort_order;

    const maxSort = (await ColorItem.max("sort_order", { where: { color_category_id: target_category_id, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction })) || 0;

    await item.update({ color_category_id: target_category_id, sort_order: maxSort + 1 }, { transaction });

    if (oldCategory && oldSort) {
      await ColorItem.decrement("sort_order", { by: 1, where: { color_category_id: oldCategory, sort_order: { [Op.gt]: oldSort }, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] }, transaction });
    }

    await transaction.commit();
    return transformColorItem(await ColorItem.findByPk(colorItemId, { include: getColorItemIncludes() }));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function copyColorItemService({ builderId, companyId, colorItemId, data }) {
  const { ColorItem, ColorItemCustomField } = db;
  const { item_name } = data;

  const transaction = await db.sequelize.transaction();
  try {
    const item = await ColorItem.findOne({ 
      where: { color_item_id: colorItemId, [Op.or]: [{ company_id: companyId }, { builder_id: builderId }] },
      include: [{ model: ColorItemCustomField, as: "customFields" }],
      transaction 
    });
    if (!item) throw { status: 404, message: "Color item not found." };

    const newItemData = { ...item.get({ plain: true }), item_name: item_name || `${item.item_name} (Copy)`, color_item_id: undefined, createdAt: undefined, updatedAt: undefined };
    const newItem = await ColorItem.create(newItemData, { transaction });

    if (item.customFields?.length > 0) {
      await ColorItemCustomField.bulkCreate(item.customFields.map(cf => ({ ...cf.get({ plain: true }), color_item_custom_field_id: undefined, color_item: newItem.color_item_id })), { transaction });
    }

    await transaction.commit();
    return transformColorItem(await ColorItem.findByPk(newItem.color_item_id, { include: getColorItemIncludes() }));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export default {
  createColorItemService,
  getColorItemsWithoutCategoryService,
  getAllColorItemsService,
  getColorItemByIdService,
  updateColorItemService,
  deleteColorItemService,
  deleteImageFieldService,
  colorItemMoveService,
  copyColorItemService,
};

