import { Op } from "sequelize";
import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase } from "../../utils/common.js";

export class ColorItemService {
  /**
   * Create a new Color Item with associated custom fields.
   * Handles sort order rebalancing and full entity validation within a transaction.
   * Models are accessed via db.ModelName at call time to ensure initModels() has run.
   */
  static async createColorItemService(data, user) {
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

    // Access models at call time (after initModels() has run)
    const { ColorItem, ColorCategory, ColorType, Range, Supplier, ColorItemCustomField, Color, ColorGroup, ColorGroupItemMap } = db;

    const requiredModels = { ColorItem, ColorCategory, ColorType, Range, Supplier, ColorItemCustomField, Color, ColorGroup, ColorGroupItemMap };
    for (const [name, model] of Object.entries(requiredModels)) {
      if (!model) throw new Error(`Model "${name}" is not registered in db. Check the modelName in its .model.js file.`);
    }

    const transaction = await db.sequelize.transaction();

    try {
      // 1. Validate color category exists and belongs to the company/builder
      let resolvedColorId = color_id;
      if (color_category_id) {
        // Build the where clause — if color_id is also provided, enforce that the
        // category belongs to that specific color
        const categoryWhere = { color_category_id };
        if (color_id) {
          categoryWhere.color_id = color_id;
        }

        const category = await ColorCategory.findOne({
          where: categoryWhere,
          include: [
            {
              model: Color,
              as: "color",
              where: {
                [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
              },
              required: true,
            },
          ],
          transaction,
        });

        if (!category) {
          if (color_id) {
            throw {
              statusCode: 400,
              message: "Invalid color_category_id: this category does not belong to the provided color_id.",
            };
          }
          throw { statusCode: 400, message: "Invalid color category ID." };
        }

        // Auto-populate color_id from category if not explicitly provided
        if (!resolvedColorId) {
          resolvedColorId = category.color_id;
        }
      }

      // 2. Validate color type IDs belong to the company/builder
      if (finalColorTypeIds && finalColorTypeIds.length > 0) {
        const colorTypes = await ColorType.findAll({
          where: {
            color_type_id: { [Op.in]: finalColorTypeIds },
            [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
          },
          transaction,
        });

        if (colorTypes.length !== finalColorTypeIds.length) {
          const foundIds = colorTypes.map((ct) => ct.color_type_id);
          const invalidIds = finalColorTypeIds.filter((id) => !foundIds.includes(id));
          throw { statusCode: 400, message: `Invalid color type IDs: ${invalidIds.join(", ")}` };
        }
      }

      // 3. Validate range IDs belong to the company/builder and are active
      if (finalRangeIds && finalRangeIds.length > 0) {
        const ranges = await Range.findAll({
          where: {
            range_id: { [Op.in]: finalRangeIds },
            is_active: true,
            [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
          },
          transaction,
        });

        if (ranges.length !== finalRangeIds.length) {
          const foundIds = ranges.map((r) => r.range_id);
          const invalidIds = finalRangeIds.filter((id) => !foundIds.includes(id));
          throw { statusCode: 400, message: `Invalid range IDs: ${invalidIds.join(", ")}` };
        }
      }

      // 4. Validate supplier belongs to the company/builder
      if (supplier_id) {
        const supplier = await Supplier.findOne({
          where: {
            supplier_id,
            [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
          },
          transaction,
        });

        if (!supplier) {
          throw { statusCode: 400, message: "Invalid supplier ID." };
        }
      }

      // 5. Check for duplicate item_code within the same company/builder scope
      const duplicateRecord = await ColorItem.findOne({
        where: {
          item_code: item_code.trim(),
          [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
        },
        transaction,
      });

      if (duplicateRecord) {
        throw { statusCode: 409, message: "Item code already exists." };
      }

      // 6. Handle sort_order: auto-assign or shift existing records
      let finalSortOrder = sort_order || null;
      if (color_category_id) {
        const maxSortOrder = (await ColorItem.max("sort_order", {
          where: {
            color_category_id,
            [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
          },
          transaction,
        })) || 0;

        if (!sort_order) {
          finalSortOrder = maxSortOrder + 1;
        } else if (sort_order <= maxSortOrder) {
          // Shift all items at or above the requested position
          await ColorItem.increment("sort_order", {
            by: 1,
            where: {
              color_category_id,
              sort_order: { [Op.gte]: sort_order },
              [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
            },
            transaction,
          });
        }
      }

      // 7. Insert the Color Item
      const colorItem = await ColorItem.create(
        {
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
        },
        { transaction }
      );

      // 8. Insert associated custom fields
      if (parsedCustomFields && parsedCustomFields.length > 0) {
        const customFieldsToCreate = parsedCustomFields.map((field) => ({
          color_item: colorItem.color_item_id,
          field_type: field.field_type,
          field_name: field.field_name,
          required_field: field.required_field || false,
          sort_order: field.sort_order || 1,
        }));

        await ColorItemCustomField.bulkCreate(customFieldsToCreate, { transaction });
      }

      // 9. Map the new color item to the color group (always runs when color_group_id is provided)
      if (color_group_id) {
        const colorGroup = await ColorGroup.findOne({
          where: {
            color_group_id,
            [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
          },
          transaction,
        });

        if (!colorGroup) {
          throw {
            statusCode: 404,
            message: "Color group not found or does not belong to your organization.",
          };
        }

        await ColorGroupItemMap.create(
          {
            color_group_id,
            color_item_id: colorItem.color_item_id,
            
          },
          { transaction }
        );
      }

      await transaction.commit();
 
      // Final Fetch: Get enriched data for the response (including names and groups)
      const enrichedItem = await ColorItem.findOne({
        where: { color_item_id: colorItem.color_item_id },
        include: [
          {
            model: ColorCategory,
            as: "colorCategory",
            include: [{ model: Color, as: "color" }],
          },
          {
            model: ColorGroupItemMap,
            as: "colorGroupItemMaps",
            include: [{ model: ColorGroup, as: "colorGroup" }],
          },
        ],
      });
 
      if (!enrichedItem) {
        return keysToCamelCase(colorItem.get({ plain: true }));
      }
 
      const plainItem = enrichedItem.get({ plain: true });
      const transformed = {
        ...keysToCamelCase(plainItem),
        categoryName: plainItem.colorCategory?.category_name || null,
        colorName: plainItem.colorCategory?.color?.color_name || null,
        colorGroups: (plainItem.colorGroupItemMaps || []).map((map) => ({
          colorGroupId: map.color_group_id,
          colorGroupName: map.colorGroup?.name || null,
        })),
      };
 
      // Clean up internal association arrays to match requested flat format
      delete transformed.colorCategory;
      delete transformed.colorGroupItemMaps;
 
      return transformed;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
