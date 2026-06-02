import db from "../config/database/models/postgre-models/index.js";
import { DRIVE_FILE_MAPPING } from "../constants/driveFile.js";
import { env } from "../config/env.config.js";

const REFERENCE_TYPE = DRIVE_FILE_MAPPING.REFERENCE_NAMES.PROPERTY_DETAIL;

const FOLDER_BY_SUB_REFERENCE = {
  [DRIVE_FILE_MAPPING.SUB_REFERENCES.COMPACTION_REPORT]: DRIVE_FILE_MAPPING.FOLDERS.COMPACTION_REPORTS,
};

/**
 * Extract relative S3 key from full HTTP(S) S3 URLs
 * Supports both domain-prefixed (bucket.s3.amazonaws.com) and path-prefixed (s3.amazonaws.com/bucket) S3 URLs
 */
export function getS3KeyFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  if (!fileUrl.startsWith("http")) return fileUrl;
  try {
    const url = new URL(fileUrl);
    let key = decodeURIComponent(url.pathname.substring(1));
    const bucketName = env.AWS.S3_BUCKET_NAME;

    // If the bucket name is part of the hostname
    if (url.hostname.startsWith(`${bucketName}.`) || url.hostname.includes(`.${bucketName}.`)) {
      return key;
    }

    // If the bucket name is part of the pathname
    if (key.startsWith(`${bucketName}/`)) {
      key = key.substring(bucketName.length + 1);
    }
    return key;
  } catch (e) {
    return fileUrl;
  }
}

async function findOrCreateFolder({ name, companyId, builderId, transaction }) {
  const { Drive } = db.sequelize.models;
  const where = { name, parent_id: null, company_id: companyId ?? null, builder_id: builderId ?? null };
  const [folder] = await Drive.findOrCreate({
    where,
    defaults: { name, company_id: companyId ?? null, builder_id: builderId ?? null },
    transaction,
  });
  return folder;
}

/**
 * Upsert a DriveFile linked to a PropertyDetail via the polymorphic
 * (reference_id, reference_type, sub_reference_type) tuple.
 */
export async function upsertPropertyDriveFile({
  propertyDetailId,
  subReferenceType = DRIVE_FILE_MAPPING.SUB_REFERENCES.COMPACTION_REPORT,
  s3Key,
  size = null,
  originalName = null,
  fileName = null,
  fileExtension = "pdf",
  mimeType = "application/pdf",
  companyId,
  builderId,
  leadId,
  uploadedBy = null,
  transaction = null,
}) {
  if (!propertyDetailId) throw new Error("upsertPropertyDriveFile: propertyDetailId is required");
  if (!s3Key) throw new Error("upsertPropertyDriveFile: s3Key is required");

  const { DriveFile } = db.sequelize.models;

  const folderName = FOLDER_BY_SUB_REFERENCE[subReferenceType];
  const folder = folderName
    ? await findOrCreateFolder({ name: folderName, companyId, builderId, transaction })
    : null;

  const resolvedOriginalName = originalName || s3Key.split("/").pop() || `${subReferenceType}.pdf`;
  const resolvedFileName = fileName || `pd_${propertyDetailId}_${subReferenceType}_${Date.now()}_${resolvedOriginalName}`;

  const existing = await DriveFile.findOne({
    where: {
      reference_id: propertyDetailId,
      reference_type: REFERENCE_TYPE,
      sub_reference_type: subReferenceType,
    },
    transaction,
  });

  if (existing) {
    await existing.update(
      {
        s3_key: s3Key,
        size: size ?? existing.size,
        file_extension: fileExtension,
        mime_type: mimeType,
        folder_id: folder?.drive_id ?? existing.folder_id,
        company_id: companyId ?? existing.company_id,
        builder_id: builderId ?? existing.builder_id,
        lead_id: leadId ?? existing.lead_id,
        uploaded_by: uploadedBy ?? existing.uploaded_by,
      },
      { transaction },
    );
    return existing;
  }

  return DriveFile.create(
    {
      folder_id: folder?.drive_id ?? null,
      company_id: companyId,
      builder_id: builderId,
      lead_id: leadId,
      uploaded_by: uploadedBy,
      reference_id: propertyDetailId,
      reference_type: REFERENCE_TYPE,
      sub_reference_type: subReferenceType,
      original_name: resolvedOriginalName,
      file_name: resolvedFileName,
      s3_key: s3Key,
      file_extension: fileExtension,
      mime_type: mimeType,
      size: size,
    },
    { transaction },
  );
}

/**
 * Delete a DriveFile linked to a PropertyDetail.
 */
export async function deletePropertyDriveFile(
  propertyDetailId,
  subReferenceType = DRIVE_FILE_MAPPING.SUB_REFERENCES.COMPACTION_REPORT,
  { transaction } = {}
) {
  const { DriveFile } = db.sequelize.models;
  return DriveFile.destroy({
    where: {
      reference_id: propertyDetailId,
      reference_type: REFERENCE_TYPE,
      sub_reference_type: subReferenceType,
    },
    transaction,
  });
}
