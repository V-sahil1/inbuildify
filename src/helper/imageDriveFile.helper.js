import { Op } from "sequelize";
import db from "../config/database/models/postgre-models/index.js";
import { env } from "../config/env.config.js";
import { deleteFromS3 } from "../utils/s3Upload.js";

/**
 * Shared DriveFile helpers for "master data" image columns (Facade.image,
 * FloorPlan.detailed_image / simple_image).
 *
 * Those columns store a DriveFile primary key (UUID FK); the real file lives in
 * drive_files. This module centralises the three things every facade /
 * floor-plan flow used to re-implement inline:
 *   1. resolving the stored UUID → absolute S3 URL on read (afterFind),
 *   2. creating a DriveFile row for a freshly uploaded image,
 *   3. deleting the file an image column currently points at.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

export const s3UrlForKey = (s3Key) =>
  s3Key ? `https://${env.AWS.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}` : null;

/**
 * afterFind hook body: replace each UUID-valued image column with its absolute
 * S3 URL. Every UUID across all rows and all `fields` is resolved with a single
 * batched DriveFile query.
 *
 * @param {object|object[]|null} results  the afterFind payload
 * @param {string[]} fields               image columns to resolve (e.g. ["image"])
 * @param {import("sequelize").Sequelize} sequelize
 * @param {import("sequelize").Transaction} [transaction]
 */
export async function resolveImageUrls(results, fields, sequelize, transaction) {
  if (!results) return;
  const { DriveFile } = sequelize.models;
  if (!DriveFile) return;

  const instances = Array.isArray(results) ? results : [results];

  const ids = new Set();
  for (const inst of instances) {
    if (!inst) continue;
    for (const field of fields) {
      if (isUuid(inst[field])) ids.add(inst[field]);
    }
  }
  if (ids.size === 0) return;

  const driveFiles = await DriveFile.findAll({
    where: { file_id: { [Op.in]: [...ids] } },
    attributes: ["file_id", "s3_key"],
    transaction,
  });
  const keyById = new Map(driveFiles.map((f) => [f.file_id, f.s3_key]));

  for (const inst of instances) {
    if (!inst) continue;
    for (const field of fields) {
      if (isUuid(inst[field])) {
        inst[field] = s3UrlForKey(keyById.get(inst[field]));
      }
    }
  }
}

/**
 * Create a DriveFile row for an uploaded image (a multer-s3 file object) and
 * return the created instance. Pass `fileId` to pre-assign the PK so the parent
 * row can be inserted in one shot with its image FK already populated.
 */
export function createImageDriveFile(
  {
    file,
    fileId = null,
    companyId,
    builderId,
    uploadedBy,
    referenceId,
    referenceType,
    subReferenceType,
    subReferenceId = null,
    namePrefix,
  },
  transaction,
) {
  return db.DriveFile.create(
    {
      ...(fileId ? { file_id: fileId } : {}),
      company_id: companyId,
      builder_id: builderId,
      uploaded_by: uploadedBy,
      original_name: file.originalname,
      file_name: `${namePrefix}_${Date.now()}_${file.originalname}`,
      s3_key: file.key,
      file_extension: file.originalname.split(".").pop(),
      mime_type: file.mimetype,
      size: file.size,
      reference_id: referenceId,
      reference_type: referenceType,
      sub_reference_id: subReferenceId,
      sub_reference_type: subReferenceType,
    },
    { transaction },
  );
}

/**
 * Delete whatever an image column currently points at. Accepts the *raw* column
 * value: a DriveFile UUID (drops the DriveFile row + its S3 object) or a legacy
 * S3 key/URL (drops just the S3 object). No-op for empty values.
 */
export async function removeImageByRef(rawValue, transaction) {
  if (!rawValue) return;
  if (isUuid(rawValue)) {
    const file = await db.DriveFile.findOne({ where: { file_id: rawValue }, transaction });
    if (file) {
      await deleteFromS3(file.s3_key);
      await file.destroy({ transaction });
    }
  } else {
    await deleteFromS3(rawValue);
  }
}

/**
 * Read raw (unresolved) image column value(s) straight from the table, bypassing
 * the afterFind URL-resolution hook. Needed before replacing/deleting an image
 * because the hook would otherwise have rewritten the UUID into a full URL.
 *
 * @returns {Promise<object>} a plain row with the requested columns (or {}).
 */
export async function getRawImageColumns(tableName, pkColumn, pkValue, columns, transaction) {
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const [[row]] = await db.sequelize.query(
    `SELECT ${cols} FROM "${tableName}" WHERE "${pkColumn}" = :pk`,
    { replacements: { pk: pkValue }, transaction },
  );
  return row || {};
}
