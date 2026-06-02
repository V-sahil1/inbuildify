/**
 * Drive Permission Resolver
 *
 * Permission levels (ordered by access power):
 *   VIEW  < EDIT < ADMIN
 *
 * Inheritance rules:
 *   - Sharing a FOLDER grants access to all nested child folders and files.
 *   - A direct share on a child entity wins if it has a HIGHER permission level.
 *   - The item owner (created_by / uploaded_by) always has implicit ADMIN.
 */

import db from "../../config/database/models/postgre-models/index.js";
import { errorResponse } from "../../helper/response.js";

const PERMISSION_RANK = { VIEW: 1, EDIT: 2, ADMIN: 3 };

/**
 * Core resolver:
 * Determines the effective permission level a user has over a given entity.
 *
 * Algorithm:
 * 1. Check direct share on the entity.
 * 2. Walk up the folder tree; for each ancestor folder, check inherited shares.
 * 3. Keep the HIGHEST permission found across all sources.
 * 4. Return null if no access.
 */
export const resolvePermission = async (userId, companyId, entityType, entityId) => {
  const { Drive, DriveFile, DriveShare } = db.sequelize.models;

  // 1. Check ownership (implicit ADMIN)
  if (entityType === "FOLDER") {
    const folder = await Drive.findOne({ where: { drive_id: entityId, company_id: companyId }, attributes: ["created_by", "parent_id"] });
    if (!folder) return null;
    if (folder.created_by === userId) return "ADMIN";
  } else {
    const file = await DriveFile.findOne({ where: { file_id: entityId, company_id: companyId }, attributes: ["uploaded_by", "folder_id"] });
    if (!file) return null;
    if (file.uploaded_by === userId) return "ADMIN";
  }

  let bestRank = 0;
  let bestPermission = null;

  // 2. Direct share on the entity
  const directShare = await DriveShare.findOne({
    where: { entity_type: entityType, entity_id: entityId, shared_with_user: userId, company_id: companyId }
  });
  if (directShare) {
    const rank = PERMISSION_RANK[directShare.permission_level] || 0;
    if (rank > bestRank) {
      bestRank = rank;
      bestPermission = directShare.permission_level;
    }
  }

  // 3. Walk up ancestor folder chain for inherited shares
  let currentFolderId = null;
  if (entityType === "FOLDER") {
    const folder = await Drive.findOne({ where: { drive_id: entityId, company_id: companyId }, attributes: ["parent_id"] });
    currentFolderId = folder?.parent_id;
  } else {
    const file = await DriveFile.findOne({ where: { file_id: entityId, company_id: companyId }, attributes: ["folder_id"] });
    currentFolderId = file?.folder_id;
  }

  // Traverse up parent chain (max depth guard at 50 to prevent infinite loops)
  let depth = 0;
  while (currentFolderId && depth < 50) {
    const inheritedShare = await DriveShare.findOne({
      where: { entity_type: "FOLDER", entity_id: currentFolderId, shared_with_user: userId, company_id: companyId }
    });
    if (inheritedShare) {
      const rank = PERMISSION_RANK[inheritedShare.permission_level] || 0;
      if (rank > bestRank) {
        bestRank = rank;
        bestPermission = inheritedShare.permission_level;
      }
    }
    const parentFolder = await Drive.findOne({ where: { drive_id: currentFolderId }, attributes: ["parent_id"] });
    currentFolderId = parentFolder?.parent_id;
    depth++;
  }

  return bestPermission;
};

/**
 * Middleware factory — creates a guard that requires a minimum permission level.
 *
 * Usage in routes:
 *   router.delete("/folders/:id", authMiddleware, requireDrivePermission("EDIT"), controller.deleteFolder);
 *
 * It detects entityType and entityId from:
 *   - req.params.id
 *   - req.query.type  (FOLDER | FILE), defaults to FOLDER for /folders/* and FILE for /files/*
 */
export const requireDrivePermission = (minPermission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.users_id;
      const companyId = req.user?.company_id;
      const entityId = req.params.id;

      if (!entityId || entityId === "root") return next(); // no permission check for root listing

      // Infer entity type from the route path
      const path = req.originalUrl || req.path;
      const entityType = path.includes("/files/") ? "FILE" : "FOLDER";

      const permission = await resolvePermission(userId, companyId, entityType, entityId);
      const userRank = PERMISSION_RANK[permission] || 0;
      const requiredRank = PERMISSION_RANK[minPermission] || 1;

      if (userRank < requiredRank) {
        return errorResponse(res, 403, `You need ${minPermission} permission to perform this action.`);
      }

      // Attach resolved permission to req for downstream use
      req.drivePermission = permission;
      return next();
    } catch (error) {
      console.error("[DrivePermission] Error resolving permission:", error);
      return errorResponse(res, 500, "Failed to verify permissions.");
    }
  };
};

// Pre-composed guards for convenience
export const canView = requireDrivePermission("VIEW");
export const canEdit = requireDrivePermission("EDIT");
export const canAdmin = requireDrivePermission("ADMIN");
