import db from "../../config/database/models/postgre-models/index.js";

// export async function createConstructionStageService({
//     builderId,
//     companyId,
//     userId,
//     builder,
//     construction_type_id,
//     stage_name,
//     days,
//     sort_order,
//     site_image,
//     inspection,
//     bg_color,
//     font_color,
// }) {
//     const transaction = await db.sequelize.transaction();

//     try {
//         // ── 1. Validate builder if provided ───────────────────────────────────────
//         if (builder) {
//             const builderExists = await db.Builder.findOne({
//                 where: { builder_id: builder },
//                 attributes: ["builder_id"],
//                 transaction,
//             });

//             if (!builderExists) {
//                 const error = new Error("Invalid builder ID.");
//                 error.status = 400;
//                 throw error;
//             }
//         }

//         // ── 2. Validate construction_type_id belongs to company/builder ───────────
//         const constructionType = await db.ConstructionType.findOne({
//             where: {
//                 construction_type_id,
//                 [db.Sequelize.Op.or]: [
//                     ...(companyId ? [{ company_id: companyId }] : []),
//                     ...(builderId ? [{ builder_id: builderId }] : []),
//                 ],
//             },
//             attributes: ["construction_type_id"],
//             transaction,
//         });

//         if (!constructionType) {
//             const error = new Error("Invalid or unauthorized construction_type_id.");
//             error.status = 400;
//             throw error;
//         }

//         // ── 3. Check duplicate stage_name for this company/builder ────────────────
//         const duplicate = await db.ConstructionStage.findOne({
//             where: {
//                 stage_name,
//                 [db.Sequelize.Op.or]: [
//                     ...(companyId ? [{ company_id: companyId }] : []),
//                     ...(builderId ? [{ builder_id: builderId }] : []),
//                 ],
//             },
//             attributes: ["construction_stage"],
//             transaction,
//         });

//         if (duplicate) {
//             const error = new Error("Construction stage with this name already exists.");
//             error.status = 409;
//             throw error;
//         }

//         // ── 4. Validate inspection value ──────────────────────────────────────────
//         const validInspectionValues = ["not_required", "stage_start", "stage_completed"];
//         if (!validInspectionValues.includes(inspection)) {
//             const error = new Error("Invalid inspection value.");
//             error.status = 400;
//             throw error;
//         }

//         // ── 5. Resolve sort_order ─────────────────────────────────────────────────

//         const maxSortOrder = await db.ConstructionStage.max("sort_order", {
//             where: {
//                 construction_type_id,
//                 [db.Sequelize.Op.or]: [
//                     ...(companyId ? [{ company_id: companyId }] : []),
//                     ...(builderId ? [{ builder_id: builderId }] : []),
//                 ],
//             },
//             transaction,
//         });

//         const maxSort = maxSortOrder ?? 0;

//         if (sort_order === undefined || sort_order === null) {
//             sort_order = maxSort + 1;
//         } else {
//             if (sort_order < 1 || sort_order > maxSort + 1) {
//                 const error = new Error(`Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`);
//                 error.status = 400;
//                 throw error;
//             }

//             // ── 6. Shift existing stages to make room ─────────────────────────────
//             if (sort_order <= maxSort) {
//                 await db.ConstructionStage.increment("sort_order", {
//                     by: 1,
//                     where: {
//                         construction_type_id,
//                         sort_order: { [db.Sequelize.Op.gte]: sort_order },
//                         [db.Sequelize.Op.or]: [
//                             ...(companyId ? [{ company_id: companyId }] : []),
//                             ...(builderId ? [{ builder_id: builderId }] : []),
//                         ],
//                     },
//                     transaction,
//                 });
//             }
//         }

//         // ── 7. Insert new construction stage ──────────────────────────────────────
//         const newStage = await db.ConstructionStage.create(
//             {
//                 company_id: companyId,
//                 builder_id: builderId,
//                 builder: builder || null,
//                 construction_type_id,
//                 stage_name,
//                 days,
//                 sort_order,
//                 site_image,
//                 inspection,
//                 bg_color: bg_color || null,
//                 font_color: font_color || null,
//                 created_by: userId,
//                 updated_by: userId,
//             },
//             { transaction }
//         );

//         // ── 8. Fetch full response with builder and construction_type details ──────
//         const fullRecord = await db.ConstructionStage.findOne({
//             where: { construction_stage: newStage.construction_stage },
//             attributes: [
//                 "construction_stage",
//                 "stage_name",
//                 "days",
//                 "sort_order",
//                 "site_image",
//                 "inspection",
//                 "bg_color",
//                 "font_color",
//                 "created_at",
//                 "updated_at",
//             ],
//             include: [
//                 {
//                     model: db.Builder,
//                     as: "builderDetail",
//                     attributes: [["builder_id", "id"], "name"],
//                     required: false,
//                 },
//                 {
//                     model: db.ConstructionType,
//                     as: "constructionType",
//                     attributes: [["construction_type_id", "id"], ["types_name", "name"]],
//                     required: false,
//                 },
//             ],
//             transaction,
//         });

//         await transaction.commit();

//         const plain = fullRecord.toJSON();

//         return {
//             construction_stage: plain.construction_stage,
//             stage_name: plain.stage_name,
//             days: plain.days,
//             sort_order: plain.sort_order,
//             site_image: plain.site_image,
//             inspection: plain.inspection,
//             bg_color: plain.bg_color,
//             font_color: plain.font_color,
//             created_at: plain.created_at,
//             updated_at: plain.updated_at,
//             builder: plain.builderDetail ?? null,       // ✅ builderDetail → builder
//             construction_type: plain.constructionType ?? null,    // ✅ constructionType → construction_type
//         };
//     } catch (error) {
//         await transaction.rollback();
//         throw error;
//     }
// }

export async function createConstructionStageService({
  builderId,
  companyId,
  userId,
  builder,
  construction_type_id,
  stage_name,
  days,
  sort_order,
  site_image,
  inspection,
  bg_color,
  font_color,
}) {
  const transaction = await db.sequelize.transaction();

  const orConditions = [];
  if (companyId) {
    orConditions.push({ company_id: companyId });
  }
  if (builderId) {
    orConditions.push({ builder_id: builderId });
  }
  const orClause = orConditions.length > 0 ? { [db.Sequelize.Op.or]: orConditions } : {};

  try {
    // ── 1. Validate builder if provided ───────────────────────────────────────
    if (builder) {
      const builderExists = await db.Builder.findOne({
        where: { builder_id: builder },
        attributes: ["builder_id"],
        transaction,
      });

      if (!builderExists) {
        const error = new Error("Invalid builder ID.");
        error.status = 400;
        throw error;
      }
    }

    // ── 2. Validate construction_type_id belongs to company/builder ───────────
    const constructionType = await db.ConstructionType.findOne({
      where: { construction_type_id, ...orClause },
      attributes: ["construction_type_id"],
      transaction,
    });

    if (!constructionType) {
      const error = new Error("Invalid or unauthorized construction_type_id.");
      error.status = 400;
      throw error;
    }

    // ── 3. Check duplicate stage_name for this company/builder ────────────────
    const duplicate = await db.ConstructionStage.findOne({
      where: { stage_name, ...orClause },
      attributes: ["construction_stage"],
      transaction,
    });

    if (duplicate) {
      const error = new Error("Construction stage with this name already exists.");
      error.status = 409;
      throw error;
    }

    // ── 4. Validate inspection value ──────────────────────────────────────────
    const validInspectionValues = ["not_required", "stage_start", "stage_completed"];
    if (!validInspectionValues.includes(inspection)) {
      const error = new Error("Invalid inspection value.");
      error.status = 400;
      throw error;
    }

    // ── 5. Resolve and validate sort_order ────────────────────────────────────
    const maxSortOrder = await db.ConstructionStage.max("sort_order", {
      where: { construction_type_id, ...orClause },
      transaction,
    });

    const maxSort = maxSortOrder ?? 0;

    if (sort_order == null) {
      sort_order = maxSort + 1;
    }

    if (sort_order < 1 || sort_order > maxSort + 1) {
      const error = new Error(`Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`);
      error.status = 400;
      throw error;
    }

    // ── 6. Shift existing stages to make room ─────────────────────────────────
    if (sort_order <= maxSort) {
      await db.ConstructionStage.increment("sort_order", {
        by: 1,
        where: {
          construction_type_id,
          sort_order: { [db.Sequelize.Op.gte]: sort_order },
          ...orClause,
        },
        transaction,
      });
    }

    // ── 7. Insert new construction stage ──────────────────────────────────────
    const newStage = await db.ConstructionStage.create(
      {
        company_id: companyId,
        builder_id: builderId,
        builder: builder || null,
        construction_type_id,
        stage_name,
        days,
        sort_order,
        site_image,
        inspection,
        bg_color: bg_color || null,
        font_color: font_color || null,
        created_by: userId,
        updated_by: userId,
      },
      { transaction },
    );

    // ── 8. Fetch full response with builder and construction_type details ──────
    const fullRecord = await db.ConstructionStage.findOne({
      where: { construction_stage: newStage.construction_stage },
      attributes: [
        "construction_stage",
        "stage_name",
        "days",
        "sort_order",
        "site_image",
        "inspection",
        "bg_color",
        "font_color",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: db.Builder,
          as: "builderRef",
          attributes: [["builder_id", "id"], "name"],
          required: false,
        },
        {
          model: db.ConstructionType,
          as: "constructionType",
          attributes: [["construction_type_id", "id"], ["types_name", "name"]],
          required: false,
        },
      ],
      transaction,
    });

    await transaction.commit();

    const plain = fullRecord.toJSON();

    return {
      construction_stage: plain.construction_stage,
      stage_name: plain.stage_name,
      days: plain.days,
      sort_order: plain.sort_order,
      site_image: plain.site_image,
      inspection: plain.inspection,
      bg_color: plain.bg_color,
      font_color: plain.font_color,
      created_at: plain.created_at,
      updated_at: plain.updated_at,
      builder: plain.builderRef ?? null,
      construction_type: plain.constructionType ?? null,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
export async function getAllConstructionStagesService({ loggedInBuilderId, builder, construction_type_id }) {
  // ── Build where clause ────────────────────────────────────────────────────
  const whereClause = builder
    ? { builder, builder_id: loggedInBuilderId }
    : { builder_id: loggedInBuilderId };

  if (construction_type_id) {
    whereClause.construction_type_id = construction_type_id;
  }

  // ── Fetch all construction stages ─────────────────────────────────────────
  const stages = await db.ConstructionStage.findAll({
    where: whereClause,
    attributes: [
      "construction_stage",
      "stage_name",
      "days",
      "sort_order",
      "site_image",
      "inspection",
      "bg_color",
      "font_color",
      "created_at",
      "updated_at",
    ],
    include: [
      {
        model: db.Builder,
        as: "builderRef",
        attributes: [["builder_id", "id"], "name"],
        required: false,
      },
      {
        model: db.ConstructionType,
        as: "constructionType",
        attributes: [["construction_type_id", "id"], ["types_name", "name"]],
        required: false,
      },
    ],
    order: [
      ["sort_order", "ASC"],
      ["created_at", "DESC"],
    ],
  });

  // ── Map response to match original shape ──────────────────────────────────
  return stages.map((stage) => {
    const plain = stage.toJSON();
    return {
      construction_stage: plain.construction_stage,
      stage_name: plain.stage_name,
      days: plain.days,
      sort_order: plain.sort_order,
      site_image: plain.site_image,
      inspection: plain.inspection,
      bg_color: plain.bg_color,
      font_color: plain.font_color,
      created_at: plain.created_at,
      updated_at: plain.updated_at,
      builder: plain.builderRef ?? null, // ✅ builderRef → builder
      construction_type: plain.constructionType ?? null, // ✅ constructionType → construction_type
    };
  });
}

export async function updateConstructionStageService({
  builderId,
  companyId,
  userId,
  construction_stage,
  stage_name,
  days,
  sort_order,
  site_image,
  inspection,
  bg_color,
  font_color,
}) {
  const transaction = await db.sequelize.transaction();

  try {
    // ── 1. Check record exists for this builder ───────────────────────────────
    const existing = await db.ConstructionStage.findOne({
      where: { construction_stage, builder_id: builderId },
      transaction,
    });

    if (!existing) {
      const error = new Error("Construction stage not found or access denied.");
      error.status = 404;
      throw error;
    }

    const oldSortOrder = existing.sort_order;
    const constructionTypeId = existing.construction_type_id;

    // ── 2. Check duplicate stage_name (excluding current record) ──────────────
    if (stage_name) {
      const duplicate = await db.ConstructionStage.findOne({
        where: {
          stage_name,
          construction_stage: { [db.Sequelize.Op.ne]: construction_stage },
          [db.Sequelize.Op.or]: [
            ...(companyId ? [{ company_id: companyId }] : []),
            ...(builderId ? [{ builder_id: builderId }] : []),
          ],
        },
        attributes: ["construction_stage"],
        transaction,
      });

      if (duplicate) {
        const error = new Error("Construction stage with this name already exists.");
        error.status = 409;
        throw error;
      }
    }

    // ── 3. Validate and reorder sort_order if changed ─────────────────────────
    if (sort_order !== undefined) {
      const maxSortOrder = await db.ConstructionStage.max("sort_order", {
        where: {
          construction_type_id: constructionTypeId,
          [db.Sequelize.Op.or]: [
            ...(companyId ? [{ company_id: companyId }] : []),
            ...(builderId ? [{ builder_id: builderId }] : []),
          ],
        },
        transaction,
      });

      const maxSort = maxSortOrder ?? 0;

      if (sort_order < 1 || sort_order > maxSort + 1) {
        const error = new Error(`Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`);
        error.status = 400;
        throw error;
      }

      if (sort_order !== oldSortOrder) {
        if (sort_order > oldSortOrder) {
          // Moving down — shift records between old and new position up
          await db.ConstructionStage.increment("sort_order", {
            by: -1,
            where: {
              construction_type_id: constructionTypeId,
              sort_order: {
                [db.Sequelize.Op.gt]: oldSortOrder,
                [db.Sequelize.Op.lte]: sort_order,
              },
              construction_stage: { [db.Sequelize.Op.ne]: construction_stage },
              [db.Sequelize.Op.or]: [
                ...(companyId ? [{ company_id: companyId }] : []),
                ...(builderId ? [{ builder_id: builderId }] : []),
              ],
            },
            transaction,
          });
        } else {
          // Moving up — shift records between new and old position down
          await db.ConstructionStage.increment("sort_order", {
            by: 1,
            where: {
              construction_type_id: constructionTypeId,
              sort_order: {
                [db.Sequelize.Op.gte]: sort_order,
                [db.Sequelize.Op.lt]: oldSortOrder,
              },
              construction_stage: { [db.Sequelize.Op.ne]: construction_stage },
              [db.Sequelize.Op.or]: [
                ...(companyId ? [{ company_id: companyId }] : []),
                ...(builderId ? [{ builder_id: builderId }] : []),
              ],
            },
            transaction,
          });
        }
      }
    }

    // ── 4. Build update payload ───────────────────────────────────────────────
    const updatePayload = { updated_by: userId };
    if (stage_name !== undefined) {
      updatePayload.stage_name = stage_name;
    }
    if (days !== undefined) {
      updatePayload.days = days;
    }
    if (sort_order !== undefined) {
      updatePayload.sort_order = sort_order;
    }
    if (site_image !== undefined) {
      updatePayload.site_image = site_image;
    }
    if (inspection !== undefined) {
      updatePayload.inspection = inspection;
    }
    if (bg_color !== undefined) {
      updatePayload.bg_color = bg_color;
    }
    if (font_color !== undefined) {
      updatePayload.font_color = font_color;
    }

    if (Object.keys(updatePayload).length === 1) {
      const error = new Error("No fields provided to update.");
      error.status = 400;
      throw error;
    }

    await existing.update(updatePayload, { transaction });

    // ── 5. Fetch full response with builder and construction_type details ──────
    const fullRecord = await db.ConstructionStage.findOne({
      where: { construction_stage },
      attributes: [
        "construction_stage",
        "stage_name",
        "days",
        "sort_order",
        "site_image",
        "inspection",
        "bg_color",
        "font_color",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: db.Builder,
          as: "builderRef",
          attributes: [["builder_id", "id"], "name"],
          required: false,
        },
        {
          model: db.ConstructionType,
          as: "constructionType",
          attributes: [["construction_type_id", "id"], ["types_name", "name"]],
          required: false,
        },
      ],
      transaction,
    });

    await transaction.commit();

    const plain = fullRecord.toJSON();

    return {
      construction_stage: plain.construction_stage,
      stage_name: plain.stage_name,
      days: plain.days,
      sort_order: plain.sort_order,
      site_image: plain.site_image,
      inspection: plain.inspection,
      bg_color: plain.bg_color,
      font_color: plain.font_color,
      created_at: plain.created_at,
      updated_at: plain.updated_at,
      builder: plain.builderRef ?? null, // ✅ builderRef → builder
      construction_type: plain.constructionType ?? null, // ✅ constructionType → construction_type
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function deleteConstructionStageService({ builderId, construction_stage }) {
  const transaction = await db.sequelize.transaction();

  try {
    // ── 1. Check record exists for this builder ───────────────────────────────
    const existing = await db.ConstructionStage.findOne({
      where: { construction_stage, builder_id: builderId },
      attributes: ["construction_stage", "sort_order", "construction_type_id"],
      transaction,
    });

    if (!existing) {
      const error = new Error("Construction stage not found or access denied.");
      error.status = 404;
      throw error;
    }

    const deletedSortOrder = existing.sort_order;
    const constructionTypeId = existing.construction_type_id;

    // ── 2. Delete the record ──────────────────────────────────────────────────
    await existing.destroy({ transaction });

    // ── 3. Shift sort_order down for all records above deleted position ────────
    await db.ConstructionStage.increment("sort_order", {
      by: -1,
      where: {
        builder_id: builderId,
        construction_type_id: constructionTypeId,
        sort_order: { [db.Sequelize.Op.gt]: deletedSortOrder },
      },
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
