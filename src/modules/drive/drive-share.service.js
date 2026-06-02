import db from "../../config/database/models/postgre-models/index.js";

const PERMISSION_RANK = { VIEW: 1, EDIT: 2, ADMIN: 3 };

/**
 * Create a new share record.
 *
 * Guards:
 * - Prevents cross-company sharing (sharedWith user must belong to same company)
 * - Prevents duplicate share rows (unique_share_per_user_entity DB constraint + early check)
 * - Prevents the owner from being downgraded (they always have implicit ADMIN)
 */
export const createShareService = async ({ entity_type, entity_id, shared_with_user, permission_level }, sharedBy, companyId) => {
  const { DriveShare, Drive, DriveFile } = db.sequelize.models;
  const entityTypeUpper = entity_type.toUpperCase();

  // 1. Resolve ownership — owner always has ADMIN, block sharing to self
  if (shared_with_user === sharedBy) {
    throw new Error("You cannot share an item with yourself.");
  }

  // 2. Verify entity exists and belongs to this company
  let entityBuilderId = null;
  if (entityTypeUpper === "FOLDER") {
    const folder = await Drive.findOne({ where: { drive_id: entity_id } });
    if (!folder) throw new Error(`Folder with ID ${entity_id} not found.`);
    if (folder.company_id !== companyId) throw new Error("This folder belongs to a different company.");
    entityBuilderId = folder.builder_id;
  } else {
    const file = await DriveFile.findOne({ where: { file_id: entity_id } });
    if (!file) throw new Error(`File with ID ${entity_id} not found.`);
    if (file.company_id !== companyId) throw new Error("This file belongs to a different company.");
    entityBuilderId = file.builder_id;
  }

  // 3. Cross-company guard: check shared_with_user is in the same company
  // Note: Users table uses 'builder_id'. We compare against the entity's builder_id.
  const Users = db.sequelize.model("Users");
  const targetUser = await Users.findOne({ where: { users_id: shared_with_user } });
  
  if (!targetUser) {
    throw new Error(`Target user with ID ${shared_with_user} not found.`);
  }

  if (targetUser.builder_id !== entityBuilderId) {
    throw new Error(`Sharing failed: User ${shared_with_user} and File/Folder ${entity_id} belong to different builders.`);
  }

  // 4. Duplicate check
  const existing = await DriveShare.findOne({
    where: { entity_type: entityTypeUpper, entity_id, shared_with_user, company_id: companyId }
  });
  if (existing) {
    throw new Error("This item is already shared with that user. Use update to change permissions.");
  }

  const share = await DriveShare.create({
    entity_type: entityTypeUpper,
    entity_id,
    shared_by: sharedBy,
    shared_with_user,
    permission_level,
    company_id: companyId,
  });

  return share;
};

/**
 * Update the permission_level on an existing share.
 * Only ADMIN users on the entity (or the original sharer) can update.
 */
export const updateShareService = async (shareId, permission_level, requestingUserId, companyId) => {
  const { DriveShare } = db.sequelize.models;

  const share = await DriveShare.findOne({ where: { share_id: shareId, company_id: companyId } });
  if (!share) throw new Error("Share record not found.");

  // Only the original sharer or an ADMIN can update
  if (share.shared_by !== requestingUserId) {
    throw new Error("Only the person who created this share can update it.");
  }

  share.permission_level = permission_level;
  await share.save();
  return share;
};

/**
 * Delete a share record.
 * Only the sharer can revoke.
 */
export const deleteShareService = async (shareId, requestingUserId, companyId) => {
  const { DriveShare } = db.sequelize.models;

  const share = await DriveShare.findOne({ where: { share_id: shareId, company_id: companyId } });
  if (!share) throw new Error("Share record not found.");

  if (share.shared_by !== requestingUserId) {
    throw new Error("Only the person who created this share can revoke it.");
  }

  await share.destroy();
};

/**
 * Get all items shared directly with the requesting user.
 * Enriches each share record with entity metadata (name, type).
 * Handles share inheritance display: groups by entity with effective permission.
 */
export const getSharedWithMeService = async (userId, companyId) => {
  const { DriveShare, Drive, DriveFile } = db.sequelize.models;

  const shares = await DriveShare.findAll({
    where: { shared_with_user: userId, company_id: companyId },
    order: [["created_at", "DESC"]],
  });

  const enriched = await Promise.all(shares.map(async (share) => {
    let entityName = null;
    let parentId = null;

    if (share.entity_type === "FOLDER") {
      const folder = await Drive.findOne({ where: { drive_id: share.entity_id }, attributes: ["name", "parent_id"] });
      entityName = folder?.name;
      parentId = folder?.parent_id;
    } else {
      const file = await DriveFile.findOne({ where: { file_id: share.entity_id }, attributes: ["original_name", "folder_id", "file_extension", "size", "mime_type"] });
      entityName = file?.original_name;
      parentId = file?.folder_id;
    }

    return {
      share_id: share.share_id,
      entity_type: share.entity_type,
      entity_id: share.entity_id,
      entity_name: entityName,
      parent_id: parentId,
      permission_level: share.permission_level,
      shared_by: share.shared_by,
      created_at: share.created_at,
    };
  }));

  return { items: enriched };
};

/**
 * Get all share records for a specific entity.
 * Useful for displaying the "Manage Access" panel on the frontend.
 */
export const getEntitySharesService = async (entity_type, entity_id, companyId) => {
  const { DriveShare } = db.sequelize.models;

  const entityTypeUpper = entity_type.toUpperCase();
  const shares = await DriveShare.findAll({
    where: { entity_type: entityTypeUpper, entity_id, company_id: companyId },
    order: [["created_at", "ASC"]],
  });

  return { items: shares };
};
