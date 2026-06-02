import { randomUUID } from "node:crypto";
import db from "../../config/database/models/postgre-models/index.js";
import { env } from "../../config/env.config.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { DRIVE_FILE_MAPPING } from "../../constants/driveFile.js";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val) => typeof val === "string" && uuidRegex.test(val);

export async function getFloorPlansService({
  builder_id,
  page = 1,
  limit = 25,
  name,
  dwelling_type_id,
  range_id,
  location_id,
  status,
}) {
  const pageValue = parseInt(page, 10);
  const limitValue = parseInt(limit, 10);
  const offset = (pageValue - 1) * limitValue;

  const where = {
    builder_id,
  };

  if (name) {
    where.name = { [db.Sequelize.Op.iLike]: `%${name}%` };
  }

  if (dwelling_type_id) {
    where.dwelling_type_id = dwelling_type_id;
  }

  if (range_id) {
    where.range_id = range_id;
  }

  if (location_id) {
    where.location_id = location_id;
  }

  if (status === "true" || status === "false") {
    where.status = status === "true";
  }

  const { count, rows } = await db.FloorPlan.findAndCountAll({
    where,
    attributes: [
      "floor_plan_id",
      "name",
      "min_land_width",
      "min_land_depth",
      "dwelling_area",
      "dwelling_type_id",
      "beds",
      "baths",
      "carpark",
      "living",
      "range_id",
      "location_id",
      "garage_area",
      "porch_area",
      "alfresco_area",
      "total_area",
      "detailed_image",
      "simple_image",
      "description",
      "status",
      "created_at",
    ],
    include: [
      {
        model: db.DwellingType,
        as: "dwellingType",
        attributes: ["name"],
        required: false,
      },
      {
        model: db.Range,
        as: "range",
        attributes: ["name"],
        required: false,
      },
      {
        model: db.Location,
        as: "location",
        attributes: ["name"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
    limit: limitValue,
    offset,
  });

  const totalPages = Math.ceil(count / limitValue);

  // Map to match the previous response structure (before camelCase conversion)
  const floorPlans = rows.map((row) => {
    const plain = row.toJSON();
    return {
      ...plain,
      dwelling_type_name: plain.dwellingType?.name || null,
      range_name: plain.range?.name || null,
      location_name: plain.location?.name || null,
      // Remove the nested objects to match original SQL response
      dwellingType: undefined,
      range: undefined,
      location: undefined,
    };
  });

  return {
    floorPlans,
    pagination: {
      currentPage: pageValue,
      totalPages,
      totalRecords: count,
      limit: limitValue,
    },
  };
}

export async function createFloorPlanService(payload) {
  const {
    company_id,
    builder_id,
    name,
    min_land_width,
    min_land_depth,
    dwelling_area,
    dwelling_type_id,
    beds,
    baths,
    carpark,
    living,
    range_id,
    garage_area,
    porch_area,
    alfresco_area,
    total_area,
    detailed_file,
    simple_file,
    description,
    status,
    created_by,
  } = payload;

  const { Op } = db.Sequelize;

  // Run all read validations in parallel on independent connections.
  const [existing, dwellingType, range] = await Promise.all([
    db.FloorPlan.findOne({
      where: { builder_id, name: { [Op.iLike]: name } },
      attributes: ["floor_plan_id"],
    }),
    dwelling_type_id
      ? db.DwellingType.findOne({
        where: { dwelling_type_id, builder_id, is_active: true },
        attributes: ["dwelling_type_id", "name"],
      })
      : Promise.resolve(null),
    range_id
      ? db.Range.findOne({
        where: { range_id, builder_id, is_active: true },
        attributes: ["range_id", "name"],
      })
      : Promise.resolve(null),
  ]);

  if (existing) {
    const error = new Error("Floor plan name already exists.");
    error.status = 409;
    throw error;
  }
  if (dwelling_type_id && !dwellingType) {
    const error = new Error("Invalid or inactive dwelling type.");
    error.status = 400;
    throw error;
  }
  if (range_id && !range) {
    const error = new Error("Invalid or inactive range.");
    error.status = 400;
    throw error;
  }

  // Pre-generate UUIDs so the parent row can be inserted in one shot
  // with both image FKs already populated (no INSERT + UPDATE cycle).
  const floorPlanId = randomUUID();
  const detailedFileId = detailed_file ? randomUUID() : null;
  const simpleFileId = simple_file ? randomUUID() : null;

  const t = await db.sequelize.transaction();
  try {
    let detailedDriveFile = null;
    let simpleDriveFile = null;

    if (detailed_file) {
      detailedDriveFile = await db.DriveFile.create({
        file_id: detailedFileId,
        company_id,
        builder_id,
        uploaded_by: created_by,
        original_name: detailed_file.originalname,
        file_name: `floor_plan_detailed_${floorPlanId}_${Date.now()}_${detailed_file.originalname}`,
        s3_key: detailed_file.key,
        file_extension: detailed_file.originalname.split(".").pop(),
        mime_type: detailed_file.mimetype,
        size: detailed_file.size,
        reference_id: floorPlanId,
        reference_type: DRIVE_FILE_MAPPING.REFERENCE_NAMES.FLOOR_PLAN,
        sub_reference_id: null,
        sub_reference_type: DRIVE_FILE_MAPPING.SUB_REFERENCES.FLOOR_PLAN_DETAILED,
      }, { transaction: t });
    }

    if (simple_file) {
      simpleDriveFile = await db.DriveFile.create({
        file_id: simpleFileId,
        company_id,
        builder_id,
        uploaded_by: created_by,
        original_name: simple_file.originalname,
        file_name: `floor_plan_simple_${floorPlanId}_${Date.now()}_${simple_file.originalname}`,
        s3_key: simple_file.key,
        file_extension: simple_file.originalname.split(".").pop(),
        mime_type: simple_file.mimetype,
        size: simple_file.size,
        reference_id: floorPlanId,
        reference_type: DRIVE_FILE_MAPPING.REFERENCE_NAMES.FLOOR_PLAN,
        sub_reference_id: null,
        sub_reference_type: DRIVE_FILE_MAPPING.SUB_REFERENCES.FLOOR_PLAN_SIMPLE,
      }, { transaction: t });
    }

    const newFloorPlan = await db.FloorPlan.create({
      floor_plan_id: floorPlanId,
      company_id,
      builder_id,
      name,
      min_land_width,
      min_land_depth,
      dwelling_area,
      dwelling_type_id,
      beds: beds || 0,
      baths: baths || 0,
      carpark: carpark || 0,
      living: living || 0,
      range_id,
      garage_area,
      porch_area,
      alfresco_area,
      total_area,
      detailed_image: detailedFileId,
      simple_image: simpleFileId,
      description,
      status: status !== undefined ? status : true,
      created_by,
      updated_by: created_by,
    }, { transaction: t });

    await t.commit();

    const s3BaseUrl = `https://${env.AWS.S3_BUCKET_NAME}.s3.amazonaws.com`;
    const plain = newFloorPlan.get({ plain: true });
    plain.detailed_image = detailedDriveFile ? `${s3BaseUrl}/${detailedDriveFile.s3_key}` : null;
    plain.simple_image = simpleDriveFile ? `${s3BaseUrl}/${simpleDriveFile.s3_key}` : null;

    return {
      ...plain,
      dwelling_type_name: dwellingType?.name || null,
      range_name: range?.name || null,
      dwellingType: undefined,
      range: undefined,
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

export async function updateFloorPlanService({
  floor_plan_id,
  builder_id,
  payload,
}) {
  const {
    name,
    min_land_width,
    min_land_depth,
    dwelling_area,
    dwelling_type_id,
    beds,
    baths,
    carpark,
    living,
    range_id,
    location_id,
    garage_area,
    porch_area,
    alfresco_area,
    total_area,
    description,
    status,
    detailed_file,
    simple_file,
    detailed_image,
    simple_image,
    updated_by,
  } = payload;

  const { Op } = db.Sequelize;

  return await db.sequelize.transaction(async (t) => {
    // 1. Fetch existing with lock
    const existing = await db.FloorPlan.findOne({
      where: { floor_plan_id, builder_id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!existing) {
      const error = new Error("Floor plan not found.");
      error.status = 404;
      throw error;
    }

    // 2. Validate status if provided
    if (status !== undefined) {
      if (existing.status === false && status === false) {
        const error = new Error("Floor plan is already inactive.");
        error.status = 403;
        throw error;
      }
    }

    // 3. Duplicate name check
    if (name) {
      const duplicate = await db.FloorPlan.findOne({
        where: {
          builder_id,
          name: { [Op.iLike]: name },
          floor_plan_id: { [Op.ne]: floor_plan_id },
        },
        transaction: t,
      });
      if (duplicate) {
        const error = new Error("Floor plan name already exists.");
        error.status = 409;
        throw error;
      }
    }

    // 4. Validate IDs
    if (dwelling_type_id) {
      const dt = await db.DwellingType.findOne({
        where: { dwelling_type_id, builder_id, is_active: true },
        transaction: t,
      });
      if (!dt) {
        const error = new Error("Invalid or inactive dwelling type.");
        error.status = 400;
        throw error;
      }
    }

    if (range_id) {
      const range = await db.Range.findOne({
        where: { range_id, builder_id, is_active: true },
        transaction: t,
      });
      if (!range) {
        const error = new Error("Invalid or inactive range.");
        error.status = 400;
        throw error;
      }
    }

    if (location_id) {
      const loc = await db.Location.findOne({
        where: { location_id, builder_id, status: true },
        transaction: t,
      });
      if (!loc) {
        const error = new Error("Invalid or inactive location.");
        error.status = 400;
        throw error;
      }
    }

    // 5. Image Management — fetch raw UUIDs directly from DB to bypass afterFind hook
    // (afterFind hook resolves UUID → full S3 URL, so isUuid() would fail on the hook's output)
    const [[rawFP]] = await db.sequelize.query(
      `SELECT "detailed_image", "simple_image" FROM "floor_plan" WHERE "floor_plan_id" = :floor_plan_id`,
      { replacements: { floor_plan_id }, transaction: t },
    );
    let updatedDetailedImageId = rawFP?.detailed_image ?? null;
    let updatedSimpleImageId = rawFP?.simple_image ?? null;

    // Detailed file updated
    if (detailed_file) {
      if (updatedDetailedImageId) {
        if (isUuid(updatedDetailedImageId)) {
          const oldFile = await db.DriveFile.findOne({
            where: { file_id: updatedDetailedImageId },
            transaction: t,
          });
          if (oldFile) {
            await deleteFromS3(oldFile.s3_key);
            await oldFile.destroy({ transaction: t });
          }
        } else {
          await deleteFromS3(updatedDetailedImageId);
        }
      }

      const driveFile = await db.DriveFile.create({
        company_id: existing.company_id,
        builder_id: existing.builder_id,
        uploaded_by: updated_by,
        original_name: detailed_file.originalname,
        file_name: `floor_plan_detailed_${floor_plan_id}_${Date.now()}_${detailed_file.originalname}`,
        s3_key: detailed_file.key,
        file_extension: detailed_file.originalname.split(".").pop(),
        mime_type: detailed_file.mimetype,
        size: detailed_file.size,
        reference_id: floor_plan_id,
        reference_type: DRIVE_FILE_MAPPING.REFERENCE_NAMES.FLOOR_PLAN,
        sub_reference_id: null,
        sub_reference_type: DRIVE_FILE_MAPPING.SUB_REFERENCES.FLOOR_PLAN_DETAILED,
      }, { transaction: t });

      updatedDetailedImageId = driveFile.file_id;
    } else if (payload.hasOwnProperty("detailed_image") && !detailed_image) {
      // Detailed image explicitly removed
      if (updatedDetailedImageId) {
        if (isUuid(updatedDetailedImageId)) {
          const oldFile = await db.DriveFile.findOne({
            where: { file_id: updatedDetailedImageId },
            transaction: t,
          });
          if (oldFile) {
            await deleteFromS3(oldFile.s3_key);
            await oldFile.destroy({ transaction: t });
          }
        } else {
          await deleteFromS3(updatedDetailedImageId);
        }
      }
      updatedDetailedImageId = null;
    }

    // Simple file updated
    if (simple_file) {
      if (updatedSimpleImageId) {
        if (isUuid(updatedSimpleImageId)) {
          const oldFile = await db.DriveFile.findOne({
            where: { file_id: updatedSimpleImageId },
            transaction: t,
          });
          if (oldFile) {
            await deleteFromS3(oldFile.s3_key);
            await oldFile.destroy({ transaction: t });
          }
        } else {
          await deleteFromS3(updatedSimpleImageId);
        }
      }

      const driveFile = await db.DriveFile.create({
        company_id: existing.company_id,
        builder_id: existing.builder_id,
        uploaded_by: updated_by,
        original_name: simple_file.originalname,
        file_name: `floor_plan_simple_${floor_plan_id}_${Date.now()}_${simple_file.originalname}`,
        s3_key: simple_file.key,
        file_extension: simple_file.originalname.split(".").pop(),
        mime_type: simple_file.mimetype,
        size: simple_file.size,
        reference_id: floor_plan_id,
        reference_type: DRIVE_FILE_MAPPING.REFERENCE_NAMES.FLOOR_PLAN,
        sub_reference_id: null,
        sub_reference_type: DRIVE_FILE_MAPPING.SUB_REFERENCES.FLOOR_PLAN_SIMPLE,
      }, { transaction: t });

      updatedSimpleImageId = driveFile.file_id;
    } else if (payload.hasOwnProperty("simple_image") && !simple_image) {
      // Simple image explicitly removed
      if (updatedSimpleImageId) {
        if (isUuid(updatedSimpleImageId)) {
          const oldFile = await db.DriveFile.findOne({
            where: { file_id: updatedSimpleImageId },
            transaction: t,
          });
          if (oldFile) {
            await deleteFromS3(oldFile.s3_key);
            await oldFile.destroy({ transaction: t });
          }
        } else {
          await deleteFromS3(updatedSimpleImageId);
        }
      }
      updatedSimpleImageId = null;
    }

    // 6. Perform Update
    await db.FloorPlan.update(
      {
        name,
        min_land_width,
        min_land_depth,
        dwelling_area,
        dwelling_type_id,
        beds,
        baths,
        carpark,
        living,
        range_id,
        location_id,
        garage_area,
        porch_area,
        alfresco_area,
        total_area,
        description,
        status,
        detailed_image: updatedDetailedImageId,
        simple_image: updatedSimpleImageId,
        updated_by,
      },
      {
        where: { floor_plan_id },
        transaction: t,
      },
    );

    // 7. Fetch final with joins
    const updated = await db.FloorPlan.findOne({
      where: { floor_plan_id },
      include: [
        { model: db.DwellingType, as: "dwellingType", attributes: ["name"] },
        { model: db.Range, as: "range", attributes: ["name"] },
        { model: db.Location, as: "location", attributes: ["name"] },
      ],
      transaction: t,
    });

    const plain = updated.get({ plain: true });

    return {
      ...plain,
      dwelling_type_name: plain.dwellingType?.name || null,
      range_name: plain.range?.name || null,
      location_name: plain.location?.name || null,
      dwellingType: undefined,
      range: undefined,
      location: undefined,
    };
  });
}

export async function deleteFloorPlanService(floor_plan_id, builder_id) {
  const t = await db.sequelize.transaction();
  try {
    const existing = await db.FloorPlan.findOne({
      where: { floor_plan_id, builder_id },
      transaction: t,
    });

    if (!existing) {
      const error = new Error("Floor plan not found or you don't have permission to delete it.");
      error.status = 404;
      throw error;
    }

    // Fetch raw UUIDs directly from DB — bypasses afterFind hook which converts UUID → URL
    const [[rawFPForDelete]] = await db.sequelize.query(
      `SELECT "detailed_image", "simple_image" FROM "floor_plan" WHERE "floor_plan_id" = :floor_plan_id`,
      { replacements: { floor_plan_id }, transaction: t },
    );

    // Clean up detailed image
    const rawDetailed = rawFPForDelete?.detailed_image;
    if (rawDetailed) {
      if (isUuid(rawDetailed)) {
        const oldFile = await db.DriveFile.findOne({
          where: { file_id: rawDetailed },
          transaction: t,
        });
        if (oldFile) {
          await deleteFromS3(oldFile.s3_key);
          await oldFile.destroy({ transaction: t });
        }
      } else {
        await deleteFromS3(rawDetailed);
      }
    }

    // Clean up simple image
    const rawSimple = rawFPForDelete?.simple_image;
    if (rawSimple) {
      if (isUuid(rawSimple)) {
        const oldFile = await db.DriveFile.findOne({
          where: { file_id: rawSimple },
          transaction: t,
        });
        if (oldFile) {
          await deleteFromS3(oldFile.s3_key);
          await oldFile.destroy({ transaction: t });
        }
      } else {
        await deleteFromS3(rawSimple);
      }
    }

    await existing.destroy({ transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

/**
 * FETCH FLOOR PLAN FILTERS
 * Fetches distinct range and dwelling type names associated with active floor plans.
 */
export const getFloorPlanFiltersService = async (builderId) => {
  const { FloorPlan, Range, DwellingType, Sequelize } = db;

  const [rangeResult, dwellingTypeResult] = await Promise.all([
    // Distinct Ranges
    FloorPlan.findAll({
      attributes: [],
      include: [
        {
          model: Range,
          as: "range",
          attributes: ["name"],
          where: { name: { [Sequelize.Op.ne]: null } },
          required: true,
        },
      ],
      where: { builder_id: builderId, is_deleted: false },
      group: ["range.name", "range.range_id"],
      order: [[Sequelize.col("range.name"), "ASC"]],
      raw: true,
    }),
    // Distinct Dwelling Types
    FloorPlan.findAll({
      attributes: [],
      include: [
        {
          model: DwellingType,
          as: "dwellingType",
          attributes: ["name"],
          where: { name: { [Sequelize.Op.ne]: null } },
          required: true,
        },
      ],
      where: { builder_id: builderId, is_deleted: false },
      group: ["dwellingType.name", "dwellingType.dwelling_type_id"],
      order: [[Sequelize.col("dwellingType.name"), "ASC"]],
      raw: true,
    }),
  ]);

  return {
    ranges: rangeResult.map((r) => r["range.name"]),
    dwellingTypes: dwellingTypeResult.map((dt) => dt["dwellingType.name"]),
  };
};

export default {
  getFloorPlansService,
  createFloorPlanService,
  updateFloorPlanService,
  deleteFloorPlanService,
  getFloorPlanFiltersService,
};
