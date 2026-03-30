import { Op, literal } from "sequelize";
import db from "../../config/database/models/postgre-models/index.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

const { sequelize, Range, Users, Package, PriceListItem } = db;

// ─────────────────────────────
// GET ALL
// ─────────────────────────────
export async function getAllRangesService(builderId) {
  return await Range.findAll({
    where: { builder_id: builderId },
    order: [["sort_order", "ASC"]],
  });
}

// ─────────────────────────────
// CREATE
// ─────────────────────────────
export async function createRangeService(data, user, files) {
  const t = await sequelize.transaction();

  try {
    const { name, user_id, sort_order, bg_color, font_color, is_active } = data;

    const logo = files?.logoUrl?.[0]?.location || null;
    const header = files?.headerUrl?.[0]?.location || null;

    const builderId = user.builder_id;
    const companyId = user.company_id;
    const createdBy = user.user_id;

    // Parse user_id
    let userIds = [];
    if (user_id) {
      if (Array.isArray(user_id)) userIds = user_id;
      else if (typeof user_id === "string") {
        userIds = user_id.includes(",")
          ? user_id.split(",").map((x) => x.trim())
          : [user_id];
      }
    }
    if (userIds.length === 0) userIds = null;

    // Validate users
    if (userIds) {
      const count = await Users.count({
        where: { users_id: { [Op.in]: userIds }, is_deleted: false },
        transaction: t,
      });
      if (count !== userIds.length) throw new Error("Invalid user IDs");
    }

    // Duplicate check
    const dup = await Range.findOne({
      where: {
        builder_id: builderId,
        [Op.and]: literal(`LOWER(name)=LOWER('${name}')`),
      },
      transaction: t,
    });
    if (dup) throw new Error("Range name already exists");

    // Sort logic
    const max = (await Range.max("sort_order", {
      where: { builder_id: builderId },
      transaction: t,
    })) ?? 0;

    let finalSort = sort_order ?? 1;

    if (finalSort < 1 || finalSort > max + 1) {
      throw new Error(`Sort must be 1 to ${max + 1}`);
    }

    await Range.increment("sort_order", {
      by: 1,
      where: {
        sort_order: { [Op.gte]: finalSort },
        builder_id: builderId,
      },
      transaction: t,
    });

    const newRange = await Range.create(
      {
        company_id: companyId,
        builder_id: builderId,
        name,
        logo_url: logo,
        header_url: header,
        user_id: userIds,
        sort_order: finalSort,
        bg_color,
        font_color,
        is_active: is_active ?? true,
        created_by: createdBy,
        updated_by: createdBy,
      },
      { transaction: t }
    );

    await t.commit();
    return newRange;

  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─────────────────────────────
// UPDATE
// ─────────────────────────────
export async function updateRangeService(range_id, data, user, files) {
  const t = await sequelize.transaction();

  try {
    const existing = await Range.findOne({
      where: { range_id, builder_id: user.builder_id },
      transaction: t,
    });

    if (!existing) throw new Error("Range not found");

    const updatePayload = {
      updated_by: user.user_id,
      updatedAt: new Date(),
    };

    if (data.name) updatePayload.name = data.name;

    if (files?.logoUrl) {
      const newLogo = files.logoUrl[0]?.location;
      if (existing.logo_url && existing.logo_url !== newLogo) {
        await deleteFromS3(existing.logo_url);
      }
      updatePayload.logo_url = newLogo;
    }

    await existing.update(updatePayload, { transaction: t });

    await t.commit();
    return existing;

  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─────────────────────────────
// DELETE
// ─────────────────────────────
export async function deleteRangeService(range_id, builderId) {
  const t = await sequelize.transaction();

  try {
    const range = await Range.findOne({
      where: { range_id, builder_id: builderId },
      transaction: t,
    });

    if (!range) throw new Error("Range not found");

    const sort = range.sort_order;

    await PriceListItem.update(
      { range_id: literal(`array_remove(range_id,'${range_id}'::uuid)`) },
      { where: literal(`'${range_id}'::uuid = ANY(range_id)`), transaction: t }
    );

    await Package.update(
      { range_id: literal(`array_remove(range_id,'${range_id}'::uuid)`) },
      { where: literal(`'${range_id}'::uuid = ANY(range_id)`), transaction: t }
    );

    await range.destroy({ transaction: t });

    await Range.decrement("sort_order", {
      by: 1,
      where: { sort_order: { [Op.gt]: sort }, builder_id: builderId },
      transaction: t,
    });

    await t.commit();
    return range;

  } catch (err) {
    await t.rollback();
    throw err;
  }
}