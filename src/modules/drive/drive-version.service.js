/**
 * Drive File Version Service (Stage C1)
 *
 * Strategy:
 * - Latest file is always the live row in `drive_files`.
 * - When uploading a new version, the CURRENT live data is first snapshotted
 *   into `drive_file_versions`, then `drive_files` is updated with the new content.
 * - Version numbers are sequential per file (1, 2, 3...).
 * - Version retention: configurable MAX_VERSIONS; oldest version is pruned + its S3
 *   object deleted when limit is exceeded.
 */

import { v4 as uuidv4 } from "uuid";
import db from "../../config/database/models/postgre-models/index.js";
import {
  uploadFile,
  deleteObject,
  generatePresignedDownloadUrl,
} from "../../service/s3.service.js";

const MAX_VERSIONS = 10; // Retain at most 10 historical versions per file

/**
 * Upload a new version of an existing file.
 * Current live content → archived in versions table.
 * New content → replaces drive_files row.
 */
export const uploadNewVersionService = async (fileId, file, companyId, userId) => {
  const { DriveFile, DriveFileVersion, DriveActivityLog } = db.sequelize.models;

  const existingFile = await DriveFile.findOne({
    where: { file_id: fileId, company_id: companyId },
  });

  if (!existingFile) throw new Error("File not found.");

  const transaction = await db.sequelize.transaction();
  try {
    // 1. Find the current highest version number for this file
    const latestVersion = await DriveFileVersion.findOne({
      where: { file_id: fileId },
      order: [["version_number", "DESC"]],
      transaction,
    });
    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    // 2. Archive the current live file data as the next historical version
    await DriveFileVersion.create({
      file_id: fileId,
      company_id: companyId,
      version_number: nextVersionNumber,
      s3_key: existingFile.s3_key,
      file_name: existingFile.file_name,
      size: existingFile.size,
      mime_type: existingFile.mime_type,
      uploaded_by: existingFile.uploaded_by,
    }, { transaction });

    // 3. Upload the new file to S3
    const ext = file.originalname.substring(file.originalname.lastIndexOf("."));
    const uniqueFileName = `${uuidv4()}${ext}`;
    const newS3Key = `drive/${companyId}/${uniqueFileName}`;

    const uploadResult = await uploadFile(newS3Key, file.buffer, file.mimetype);
    if (!uploadResult.success) throw new Error("Failed to upload new version to S3.");

    // 4. Update the live drive_files row with the new data
    await existingFile.update({
      s3_key: newS3Key,
      file_name: uniqueFileName,
      file_extension: ext,
      mime_type: file.mimetype,
      size: file.size,
      uploaded_by: userId,
      // Reset thumbnail for regeneration on next access
      thumbnail_s3_key: null,
      thumbnail_status: 'pending',
    }, { transaction });

    await transaction.commit();

    // 5. Enforce version retention: prune oldest versions beyond MAX_VERSIONS
    setImmediate(async () => {
      try {
        const allVersions = await DriveFileVersion.findAll({
          where: { file_id: fileId },
          order: [["version_number", "ASC"]],
          attributes: ["version_id", "s3_key"],
        });
        if (allVersions.length > MAX_VERSIONS) {
          const toDelete = allVersions.slice(0, allVersions.length - MAX_VERSIONS);
          const s3Keys = toDelete.map((v) => v.s3_key);
          // Delete from S3
          for (const key of s3Keys) {
            await deleteObject(key).catch((e) => console.error("[VersionPurge] S3 delete failed:", e));
          }
          // Delete from DB
          const ids = toDelete.map((v) => v.version_id);
          await DriveFileVersion.destroy({ where: { version_id: ids } });
          console.log(`[VersionPurge] Pruned ${toDelete.length} old versions for file ${fileId}`);
        }
      } catch (err) {
        console.error("[VersionPurge] Error during retention enforcement:", err);
      }
    });

    // 6. Log activity
    if (DriveActivityLog) {
      await DriveActivityLog.create({
        company_id: companyId,
        user_id: userId,
        action: "NEW_VERSION",
        entity_type: "FILE",
        entity_id: fileId,
        entity_name: existingFile.original_name,
        details: `Version ${nextVersionNumber + 1} uploaded`,
      }).catch((e) => console.error("[ActivityLog] Error:", e));
    }

    return {
      file_id: fileId,
      current_version: nextVersionNumber + 1,
      s3_key: newS3Key,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * List all historical versions for a file (NOT including the current live version).
 */
export const getFileVersionsService = async (fileId, companyId) => {
  const { DriveFile, DriveFileVersion } = db.sequelize.models;

  const file = await DriveFile.findOne({ where: { file_id: fileId, company_id: companyId } });
  if (!file) throw new Error("File not found.");

  const versions = await DriveFileVersion.findAll({
    where: { file_id: fileId, company_id: companyId },
    order: [["version_number", "DESC"]],
  });

  return {
    file_id: fileId,
    current: {
      s3_key: file.s3_key,
      size: file.size,
      mime_type: file.mime_type,
      uploaded_by: file.uploaded_by,
      updated_at: file.updated_at,
    },
    versions: versions.map((v) => ({
      version_id: v.version_id,
      version_number: v.version_number,
      s3_key: v.s3_key,
      size: v.size,
      mime_type: v.mime_type,
      uploaded_by: v.uploaded_by,
      created_at: v.created_at,
    })),
  };
};

/**
 * Generate a private signed download URL for a specific historical version.
 */
export const getVersionDownloadUrlService = async (fileId, versionId, companyId) => {
  const { DriveFileVersion } = db.sequelize.models;

  const version = await DriveFileVersion.findOne({
    where: { version_id: versionId, file_id: fileId, company_id: companyId },
  });
  if (!version) throw new Error("Version not found.");

  const result = await generatePresignedDownloadUrl(version.s3_key);
  if (!result.success) throw new Error("Failed to generate download URL.");

  return result.url;
};

/**
 * Restore a historical version as the current live file.
 * This creates a new version entry from the current state before reverting.
 */
export const restoreVersionService = async (fileId, versionId, companyId, userId) => {
  const { DriveFile, DriveFileVersion, DriveActivityLog } = db.sequelize.models;

  const file = await DriveFile.findOne({ where: { file_id: fileId, company_id: companyId } });
  if (!file) throw new Error("File not found.");

  const version = await DriveFileVersion.findOne({
    where: { version_id: versionId, file_id: fileId, company_id: companyId },
  });
  if (!version) throw new Error("Version not found.");

  const transaction = await db.sequelize.transaction();
  try {
    // Archive current as a new version
    const latestVersion = await DriveFileVersion.findOne({
      where: { file_id: fileId },
      order: [["version_number", "DESC"]],
      transaction,
    });
    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    await DriveFileVersion.create({
      file_id: fileId,
      company_id: companyId,
      version_number: nextVersionNumber,
      s3_key: file.s3_key,
      file_name: file.file_name,
      size: file.size,
      mime_type: file.mime_type,
      uploaded_by: file.uploaded_by,
    }, { transaction });

    // Restore the target version to live
    await file.update({
      s3_key: version.s3_key,
      file_name: version.file_name,
      mime_type: version.mime_type,
      size: version.size,
      uploaded_by: userId,
      thumbnail_s3_key: null,
      thumbnail_status: 'pending',
    }, { transaction });

    await transaction.commit();

    if (DriveActivityLog) {
      await DriveActivityLog.create({
        company_id: companyId,
        user_id: userId,
        action: "RESTORE_VERSION",
        entity_type: "FILE",
        entity_id: fileId,
        entity_name: file.original_name,
        details: `Restored to version ${version.version_number}`,
      }).catch((e) => console.error("[ActivityLog] Error:", e));
    }

    return { file_id: fileId, restored_version: version.version_number };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Delete a specific historical version (hard delete from DB + S3).
 */
export const deleteVersionService = async (fileId, versionId, companyId, userId) => {
  const { DriveFileVersion } = db.sequelize.models;

  const version = await DriveFileVersion.findOne({
    where: { version_id: versionId, file_id: fileId, company_id: companyId },
  });
  if (!version) throw new Error("Version not found.");

  await deleteObject(version.s3_key);
  await version.destroy();
};
