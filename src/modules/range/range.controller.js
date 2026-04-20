import { Op, literal } from "sequelize";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import db from "../../config/database/models/postgre-models/index.js";

// ─────────────────────────────────────────────
// GET ALL RANGES
// ─────────────────────────────────────────────
export async function getAllRanges(req, res) {
  try {
    const builderId = req.user.builder_id;

    const { Range } = db;

    const ranges = await Range.findAll({
      where: { builder_id: builderId },
      order: [["sort_order", "ASC"]],
    });

    return successResponse(
      res,
      keysToCamelCase(ranges.map((r) => r.toJSON())),
      "Ranges fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching ranges:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  }
}

// ─────────────────────────────────────────────
// CREATE RANGE
// ─────────────────────────────────────────────
export async function createRange(req, res) {
  const { sequelize, Range, Users } = db;
  const t = await sequelize.transaction();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;

    const { name, user_id, sort_order, bg_color, font_color, is_active } =
      req.body;

    const logo_image = req.files?.logoUrl?.[0]?.location || null;
    const header_image = req.files?.headerUrl?.[0]?.location || null;

    if (!builderId) {
      await t.rollback();
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    // ── Parse user_id ──────────────────────────────────────────
    let userIdArray = [];

    if (user_id) {
      if (Array.isArray(user_id)) {
        userIdArray = user_id;
      } else if (typeof user_id === "string") {
        if (user_id.trim().startsWith("[")) {
          userIdArray = JSON.parse(user_id);
        } else {
          userIdArray = user_id.split(",").map((x) => x.trim());
        }
      }
    }

    if (userIdArray.length === 0) userIdArray = null;

    // ── Validate user IDs ──────────────────────────────────────
    if (userIdArray) {
      const validUsers = await Users.count({
        where: {
          users_id: { [Op.in]: userIdArray },
          is_deleted: false,
        },
        transaction: t,
      });

      if (validUsers !== userIdArray.length) {
        await t.rollback();
        return errorResponse(res, 400, "One or more user IDs are invalid.");
      }
    }

    // ── Duplicate name check ───────────────────────────────────
    const dupCheck = await Range.findOne({
      where: {
        builder_id: builderId,
        [Op.and]: literal(`LOWER(name) = LOWER('${name.replace(/'/g, "''")}')`),
      },
      transaction: t,
    });

    if (dupCheck) {
      await t.rollback();
      return errorResponse(res, 400, "Range name already exists.");
    }

    // ── Determine sort_order ───────────────────────────────────
    let finalSortOrder = sort_order ?? 1;

    const maxSortOrder = (await Range.max("sort_order", {
      where: { builder_id: builderId },
      transaction: t,
    })) ?? 0;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await t.rollback();
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    // ── Shift existing sort_orders up ─────────────────────────
    await Range.increment("sort_order", {
      by: 1,
      where: {
        sort_order: { [Op.gte]: finalSortOrder },
        builder_id: builderId,
      },
      transaction: t,
    });

    // ── Insert new range ───────────────────────────────────────
    const newRange = await Range.create(
      {
        company_id: companyId,
        builder_id: builderId,
        name,
        logo_url: logo_image,
        header_url: header_image,
        user_id: userIdArray,
        sort_order: finalSortOrder,
        bg_color: bg_color || null,
        font_color: font_color || null,
        is_active: is_active ?? true,
        created_by: createdBy,
        updated_by: createdBy,
      },
      { transaction: t },
    );

    await t.commit();

    return successResponse(
      res,
      keysToCamelCase(newRange.toJSON()),
      "Range created successfully.",
    );
  } catch (err) {
    await t.rollback();
    console.error("Error creating range:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  }
}

// ─────────────────────────────────────────────
// UPDATE RANGE
// ─────────────────────────────────────────────
export async function updateRange(req, res) {
  const { sequelize, Range, Users } = db;
  const t = await sequelize.transaction();

  try {
    const { range_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    if (!builderId) {
      await t.rollback();
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    let { name, user_id, sort_order, bg_color, font_color } = req.body;

    const logo_image = req.files?.logoUrl?.[0]?.location || req.body.logo_url;
    const header_image =
      req.files?.headerUrl?.[0]?.location || req.body.header_url;

    // ── Fetch existing range ───────────────────────────────────
    const existingRange = await Range.findOne({
      where: { range_id, builder_id: builderId },
      transaction: t,
    });

    if (!existingRange) {
      await t.rollback();
      return errorResponse(res, 404, "Range not found for this builder.");
    }

    if (!existingRange.is_active) {
      await t.rollback();
      return errorResponse(res, 404, "Inactive range.");
    }

    // ── Parse user_id ──────────────────────────────────────────
    if (user_id) {
      try {
        if (typeof user_id === "string" && user_id.trim().startsWith("[")) {
          user_id = JSON.parse(user_id);
        } else if (
          typeof user_id === "string" &&
          user_id.startsWith("{") &&
          user_id.endsWith("}")
        ) {
          user_id = [user_id.replace(/[{}"]/g, "")];
        } else if (typeof user_id === "string" && user_id.includes(",")) {
          user_id = user_id.split(",").map((x) => x.trim());
        } else if (typeof user_id === "string") {
          user_id = [user_id.trim()];
        } else if (!Array.isArray(user_id)) {
          await t.rollback();
          return errorResponse(res, 400, "Invalid user_id format.");
        }
      } catch {
        await t.rollback();
        return errorResponse(res, 400, "Invalid user_id format.");
      }
    }

    // ── Validate user IDs ──────────────────────────────────────
    if (user_id && user_id.length > 0) {
      const validUsers = await Users.count({
        where: {
          users_id: { [Op.in]: user_id },
          is_deleted: false,
        },
        transaction: t,
      });

      if (validUsers !== user_id.length) {
        await t.rollback();
        return errorResponse(
          res,
          400,
          "One or more user IDs are invalid or do not exist.",
        );
      }
    }

    // ── Duplicate name check ───────────────────────────────────
    if (name) {
      const dupName = await Range.findOne({
        where: {
          builder_id: builderId,
          range_id: { [Op.ne]: range_id },
          [Op.and]: literal(
            `LOWER(name) = LOWER('${name.trim().replace(/'/g, "''")}')`,
          ),
        },
        transaction: t,
      });

      if (dupName) {
        await t.rollback();
        return errorResponse(res, 400, "Range name already exists.");
      }
    }

    // ── Sort order rebalancing ─────────────────────────────────
    const existingSortOrder = existingRange.sort_order;

    if (sort_order !== undefined && sort_order !== null) {
      const maxSortOrder = (await Range.max("sort_order", {
        where: { builder_id: builderId },
        transaction: t,
      })) ?? 0;

      if (sort_order < 1 || sort_order > maxSortOrder) {
        await t.rollback();
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          // Moving down: shift affected rows up
          await Range.decrement("sort_order", {
            by: 1,
            where: {
              sort_order: { [Op.gt]: existingSortOrder, [Op.lte]: sort_order },
              range_id: { [Op.ne]: range_id },
              builder_id: builderId,
            },
            transaction: t,
          });
        } else {
          // Moving up: shift affected rows down
          await Range.increment("sort_order", {
            by: 1,
            where: {
              sort_order: { [Op.gte]: sort_order, [Op.lt]: existingSortOrder },
              range_id: { [Op.ne]: range_id },
              builder_id: builderId,
            },
            transaction: t,
          });
        }
      }
    }

    // ── Build update payload ───────────────────────────────────
    const updatePayload = { updated_by: userId, updatedAt: new Date() };

    if (name) updatePayload.name = name.trim();
    if (user_id) updatePayload.user_id = user_id;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;
    if (bg_color) updatePayload.bg_color = bg_color;
    if (font_color) updatePayload.font_color = font_color;

    // ── Handle logo URL ────────────────────────────────────────
    if (logo_image !== undefined) {
      if (!logo_image) {
        updatePayload.logo_url = null;
      } else {
        if (existingRange.logo_url && existingRange.logo_url !== logo_image) {
          await deleteFromS3(existingRange.logo_url);
        }
        updatePayload.logo_url = logo_image;
      }
    }

    // ── Handle header URL ──────────────────────────────────────
    if (header_image !== undefined) {
      if (!header_image) {
        updatePayload.header_url = null;
      } else {
        if (
          existingRange.header_url &&
          existingRange.header_url !== header_image
        ) {
          await deleteFromS3(existingRange.header_url);
        }
        updatePayload.header_url = header_image;
      }
    }

    // updated_by + updatedAt are always set — check for anything beyond those 2
    if (Object.keys(updatePayload).length <= 2) {
      await t.rollback();
      return errorResponse(res, 400, "No fields provided to update.");
    }

    await existingRange.update(updatePayload, { transaction: t });

    await t.commit();

    return successResponse(
      res,
      keysToCamelCase(existingRange.toJSON()),
      "Range updated successfully.",
    );
  } catch (err) {
    await t.rollback();
    console.error("Error updating range:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  }
}

// ─────────────────────────────────────────────
// DELETE RANGE
// ─────────────────────────────────────────────
export async function deleteRange(req, res) {
  const { sequelize, Range, Package, PriceListItem } = db;
  const t = await sequelize.transaction();

  try {
    const { range_id } = req.params;
    const builderId = req.user.builder_id;

    const existingRange = await Range.findOne({
      where: { range_id, builder_id: builderId },
      transaction: t,
    });

    if (!existingRange) {
      await t.rollback();
      return errorResponse(res, 404, "Range not found for this builder");
    }

    const deletedSortOrder = existingRange.sort_order;

    // ── Remove range_id from price_list_item arrays ────────────
    await PriceListItem.update(
      { range_id: literal(`array_remove(range_id, '${range_id}'::uuid)`) },
      { where: literal(`'${range_id}'::uuid = ANY(range_id)`), transaction: t },
    );

    // ── Remove range_id from package arrays ───────────────────
    await Package.update(
      { range_id: literal(`array_remove(range_id, '${range_id}'::uuid)`) },
      { where: literal(`'${range_id}'::uuid = ANY(range_id)`), transaction: t },
    );

    // ── Delete the range ───────────────────────────────────────
    await existingRange.destroy({ transaction: t });

    // ── Compact sort_orders ────────────────────────────────────
    await Range.decrement("sort_order", {
      by: 1,
      where: {
        sort_order: { [Op.gt]: deletedSortOrder },
        builder_id: builderId,
      },
      transaction: t,
    });

    await t.commit();

    return successResponse(
      res,
      keysToCamelCase(existingRange.toJSON()),
      "Range deleted successfully.",
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  }
}

// ─────────────────────────────────────────────
// UPDATE RANGE ACTIVE STATUS
// ─────────────────────────────────────────────
export async function updateRangeActive(req, res) {
  const { Range } = db;
  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { range_id } = req.params;
    const { is_active } = req.body;

    if (!range_id) {
      return errorResponse(res, 400, "range id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(res, 400, "is_active must be boolean (true or false)");
    }

    const existingRange = await Range.findOne({
      where: { range_id, builder_id: builderId },
    });

    if (!existingRange) {
      return errorResponse(res, 404, "range not found for this builder");
    }

    await existingRange.update({
      is_active,
      updated_by: userId,
      updatedAt: new Date(),
    });

    return successResponse(
      res,
      keysToCamelCase(existingRange.toJSON()),
      "Range status updated successfully.",
    );
  } catch (error) {
    console.error("Error updating range is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  }
}