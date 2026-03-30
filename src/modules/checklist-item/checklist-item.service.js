import db from "../../config/database/models/postgre-models/index.js";

export async function createChecklistItemService({
  builderId,
  checklist_id,
  construction_type_id,
  construction_stage_id,
  description,
  notes,
  is_required,
  type,
  sort,
}) {
  const transaction = await db.sequelize.transaction();

  try {
    // ── 1. Validate checklist belongs to builder and is active ───────────────
    const checklist = await db.Checklist.findOne({
      where: {
        checklist_id,
        builder_id: builderId,
        is_deleted: false,
        is_active: true,
      },
      attributes: ["checklist_id"],
      transaction,
    });

    if (!checklist) {
      const error = new Error("Checklist is invalid or inactive.");
      error.status = 403;
      throw error;
    }

    // ── 2. Validate construction_type_id if provided ─────────────────────────
    if (construction_type_id) {
      const constructionType = await db.ConstructionType.findOne({
        where: {
          construction_type_id,
          builder_id: builderId,
        },
        attributes: ["construction_type_id"],
        transaction,
      });

      if (!constructionType) {
        const error = new Error("Invalid construction_type_id.");
        error.status = 400;
        throw error;
      }
    }

    // ── 3. Validate construction_stage_id if provided ────────────────────────
    if (construction_stage_id) {
      const stageWhere = {
        construction_stage: construction_stage_id,
        builder_id: builderId,
      };

      if (construction_type_id) {
        stageWhere.construction_type_id = construction_type_id;
      }

      const stage = await db.ConstructionStage.findOne({
        where: stageWhere,
        attributes: ["construction_stage"],
        transaction,
      });

      if (!stage) {
        const error = new Error("Invalid construction_stage_id or mismatch with construction_type.");
        error.status = 400;
        throw error;
      }
    }

    // ── 4. Check for duplicate description in same checklist ─────────────────
    const duplicate = await db.ChecklistItem.findOne({
      where: { checklist_id, description },
      include: [
        {
          model: db.Checklist,
          as: "checklist",
          where: { builder_id: builderId, is_deleted: false },
          attributes: [],
        },
      ],
      attributes: ["checklist_item_id"],
      transaction,
    });

    if (duplicate) {
      const error = new Error("Description with this name already exists for this checklist.");
      error.status = 409;
      throw error;
    }

    // ── 5. Validate sort range ───────────────────────────────────────────────
    const maxSortResult = await db.ChecklistItem.max("sort", {
      where: { checklist_id },
      transaction,
    });

    const maxSort = maxSortResult ?? 0;

    if (sort < 1 || sort > maxSort + 1) {
      const error = new Error(`Invalid sort. Allowed range is 1 to ${maxSort + 1}.`);
      error.status = 400;
      throw error;
    }

    // ── 6. Shift existing items sort order to make room ──────────────────────
    await db.ChecklistItem.increment("sort", {
      by: 1,
      where: {
        checklist_id,
        sort: { [db.Sequelize.Op.gte]: sort },
      },
      transaction,
    });

    // ── 7. Insert new checklist item ─────────────────────────────────────────
    const newItem = await db.ChecklistItem.create(
      {
        checklist_id,
        construction_type_id,
        construction_stage_id,
        description,
        notes,
        is_required,
        type,
        sort,
      },
      { transaction }
    );

    await transaction.commit();

    return newItem.toJSON();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}