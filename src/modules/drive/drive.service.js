import db from "../../config/database/models/postgre-models/index.js";
import { uploadFile, deleteObject, deleteObjects, generatePresignedDownloadUrl } from "../../service/s3.service.js";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { scheduleThumbnailGeneration } from "./drive-thumbnail.service.js";

// --- Folder Services ---

export const createFolderService = async (folderData) => {
  const { Drive } = db.sequelize.models;
  
  // Check for duplicate name in the same parent folder
  const existingFolder = await Drive.findOne({
    where: {
      name: folderData.name,
      parent_id: folderData.parent_id || null,
      company_id: folderData.company_id
    }
  });

  if (existingFolder) {
    throw new Error("A folder with this name already exists in this location.");
  }

  // Create folder
  const folder = await Drive.create(folderData);

  const { DriveActivityLog } = db.sequelize.models;
  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: folderData.company_id, user_id: folderData.created_by,
      action: "CREATE", entity_type: "FOLDER", entity_id: folder.drive_id, entity_name: folder.name
    }).catch(e => console.error("Error logging activity", e));
  }

  return folder;
};

export const getFolderContentsService = async (folderId, companyId, builderId) => {
  const { Drive, DriveFile } = db.sequelize.models;

  // Retrieve child folders
  const folders = await Drive.findAll({
    where: {
      parent_id: folderId || null,
      company_id: companyId,
      ...(builderId ? { builder_id: builderId } : {})
    },
    order: [["name", "ASC"]]
  });

  // Retrieve files within the folder
  const files = await DriveFile.findAll({
    where: {
      folder_id: folderId || null,
      company_id: companyId,
      ...(builderId ? { builder_id: builderId } : {})
    },
    order: [["original_name", "ASC"]]
  });

  const formattedFolders = folders.map(f => ({
    id: f.drive_id,
    type: 'folder',
    name: f.name,
    parent_id: f.parent_id,
    created_at: f.created_at,
    updated_at: f.updated_at
  }));

  const formattedFiles = files.map(f => ({
    id: f.file_id,
    type: 'file',
    name: f.original_name,
    file_extension: f.file_extension,
    size: f.size,
    mime_type: f.mime_type,
    url: f.s3_key, // The frontend usually resolves s3_key to a real URL or we can provide it
    parent_id: f.folder_id,
    created_at: f.created_at,
    updated_at: f.updated_at
  }));

  return {
    folders: formattedFolders,
    files: formattedFiles,
    items: [...formattedFolders, ...formattedFiles] // Combined for easy tree UI rendering
  };
};

export const getRootFoldersService = async (companyId, builderId) => {
  const { Drive } = db.sequelize.models;

  const folders = await Drive.findAll({
    where: {
      parent_id: null,
      company_id: companyId,
      ...(builderId ? { builder_id: builderId } : {})
    },
    order: [["name", "ASC"]]
  });

  return folders.map(f => ({
    id: f.drive_id,
    name: f.name,
    parent_id: f.parent_id,
    created_at: f.created_at,
    updated_at: f.updated_at
  }));
};

export const renameFolderService = async (folderId, newName, companyId, userId) => {
  const { Drive } = db.sequelize.models;

  const folder = await Drive.findOne({
    where: { drive_id: folderId, company_id: companyId }
  });

  if (!folder) {
    throw new Error("Folder not found or unauthorized.");
  }

  // Check for duplicates
  const existingFolder = await Drive.findOne({
    where: {
      name: newName,
      parent_id: folder.parent_id,
      company_id: companyId
    }
  });

  if (existingFolder && existingFolder.drive_id !== folderId) {
    throw new Error("A folder with this name already exists in this location.");
  }

  folder.name = newName;
  folder.updated_by = userId;
  await folder.save();

  const { DriveActivityLog } = db.sequelize.models;
  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: userId,
      action: "RENAME", entity_type: "FOLDER", entity_id: folderId, entity_name: newName
    }).catch(e => console.error("Error logging activity", e));
  }

  return folder;
};

export const deleteFolderService = async (folderId, companyId) => {
  const { Drive, DriveFile } = db.sequelize.models;
  const transaction = await db.sequelize.transaction();

  try {
    const folder = await Drive.findOne({
      where: { drive_id: folderId, company_id: companyId },
      transaction
    });

    if (!folder) {
      throw new Error("Folder not found or unauthorized.");
    }

    // Recursively find all child folder IDs
    const getAllChildFolderIds = async (parentId) => {
      const children = await Drive.findAll({
        where: { parent_id: parentId, company_id: companyId },
        attributes: ['drive_id'],
        transaction
      });
      let ids = children.map(c => c.drive_id);
      for (const child of children) {
        ids = ids.concat(await getAllChildFolderIds(child.drive_id));
      }
      return ids;
    };

    const childFolderIds = await getAllChildFolderIds(folderId);
    const allFolderIds = [folderId, ...childFolderIds];

    // Get S3 keys before deleting
    const filesToDelete = await DriveFile.findAll({
      where: { folder_id: allFolderIds },
      attributes: ['s3_key'],
      transaction
    });
    const s3Keys = filesToDelete.map(f => f.s3_key);

    // Delete files in all these folders
    await DriveFile.destroy({
      where: { folder_id: allFolderIds },
      transaction
    });

    // Delete all the folders
    await Drive.destroy({
      where: { drive_id: allFolderIds },
      transaction
    });

    await transaction.commit();

    const { DriveActivityLog } = db.sequelize.models;
    if (DriveActivityLog) {
      await DriveActivityLog.create({
        company_id: companyId, user_id: null,
        action: "DELETE", entity_type: "FOLDER", entity_id: folderId, entity_name: folder.name
      }).catch(e => console.error("Error logging activity", e));
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// --- File Services ---

export const uploadFileService = async (file, metadata) => {
  const { DriveFile } = db.sequelize.models;
  
  const ext = file.originalname.substring(file.originalname.lastIndexOf("."));
  const uniqueFileName = `${uuidv4()}${ext}`;
  const s3Key = `drive/${metadata.company_id}/${uniqueFileName}`;

  // 1. Upload to S3
  const uploadResult = await uploadFile(s3Key, file.buffer, file.mimetype);
  
  if (!uploadResult.success) {
    throw new Error("Failed to upload file to S3");
  }

  // 2. Save metadata in DB
  const newFile = await DriveFile.create({
    folder_id: metadata.folder_id,
    company_id: metadata.company_id,
    builder_id: metadata.builder_id,
    uploaded_by: metadata.uploaded_by,
    original_name: file.originalname,
    file_name: uniqueFileName,
    s3_key: s3Key,
    file_extension: ext,
    mime_type: file.mimetype,
    size: file.size
  });

  const { DriveActivityLog } = db.sequelize.models;
  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: metadata.company_id, user_id: metadata.uploaded_by,
      action: "UPLOAD", entity_type: "FILE", entity_id: newFile.file_id, entity_name: newFile.original_name
    }).catch(e => console.error("Error logging activity", e));
  }

  // Fire-and-forget thumbnail generation — never blocks the upload response
  setImmediate(() => {
    scheduleThumbnailGeneration(file.buffer, file.mimetype, newFile.file_id, metadata.company_id)
      .catch(e => console.error("[Thumbnail] Async generation error:", e));
  });

  return newFile;
};

export const getFilesService = async (folderId, companyId) => {
  const { DriveFile } = db.sequelize.models;
  
  const where = { company_id: companyId };
  if (folderId) {
    where.folder_id = folderId === "root" ? null : folderId;
  }

  const files = await DriveFile.findAll({
    where,
    order: [["created_at", "DESC"]]
  });

  return files;
};

export const renameFileService = async (fileId, newName, companyId) => {
  const { DriveFile } = db.sequelize.models;

  const file = await DriveFile.findOne({
    where: { file_id: fileId, company_id: companyId }
  });

  if (!file) {
    throw new Error("File not found or unauthorized.");
  }

  file.original_name = newName;
  await file.save();

  const { DriveActivityLog } = db.sequelize.models;
  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: null, // userId if available in arguments
      action: "RENAME", entity_type: "FILE", entity_id: fileId, entity_name: newName
    }).catch(e => console.error("Error logging activity", e));
  }

  return file;
};

export const deleteFileService = async (fileId, companyId, userId) => {
  const { DriveFile, DriveActivityLog } = db.sequelize.models;
  
  const file = await DriveFile.findOne({
    where: { file_id: fileId, company_id: companyId }
  });

  if (!file) {
    throw new Error("File not found or unauthorized.");
  }

  await file.destroy();

  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: userId,
      action: "DELETE", entity_type: "FILE", entity_id: fileId, entity_name: file.original_name
    }).catch(e => console.error("Error logging activity", e));
  }
};

export const getDownloadUrlService = async (fileId, companyId) => {
  const { DriveFile } = db.sequelize.models;
  const file = await DriveFile.findOne({ where: { file_id: fileId, company_id: companyId } });
  if (!file) throw new Error("File not found");
  
  const result = await generatePresignedDownloadUrl(file.s3_key);
  if (!result.success) throw new Error("Failed to generate download URL");
  
  return result.url;
};

export const moveFileService = async (fileId, newFolderId, companyId, userId) => {
  const { Drive, DriveFile, DriveActivityLog } = db.sequelize.models;
  const file = await DriveFile.findOne({ where: { file_id: fileId, company_id: companyId } });
  if (!file) throw new Error("File not found");
  
  const destFolderId = newFolderId === "root" ? null : newFolderId;
  if (destFolderId) {
    const folder = await Drive.findOne({ where: { drive_id: destFolderId, company_id: companyId }});
    if (!folder) throw new Error("Destination folder not found");
  }

  file.folder_id = destFolderId;
  await file.save();

  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: userId,
      action: "MOVE", entity_type: "FILE", entity_id: file.file_id, entity_name: file.original_name,
      details: `Moved file to ${destFolderId ? 'folder ' + destFolderId : 'root'}`
    }).catch(e => console.error("Error logging activity", e));
  }

  return file;
};

export const moveFolderService = async (folderId, newParentId, companyId, userId) => {
  const { Drive, DriveActivityLog } = db.sequelize.models;
  const folder = await Drive.findOne({ where: { drive_id: folderId, company_id: companyId }});
  if (!folder) throw new Error("Folder not found");

  const destParentId = newParentId === "root" ? null : newParentId;
  if (destParentId === folderId) throw new Error("Cannot move a folder into itself");

  if (destParentId) {
    const destFolder = await Drive.findOne({ where: { drive_id: destParentId, company_id: companyId }});
    if (!destFolder) throw new Error("Destination folder not found");
  }

  if (destParentId) {
    const getAllChildFolderIds = async (parentId) => {
      const children = await Drive.findAll({ where: { parent_id: parentId, company_id: companyId }, attributes: ['drive_id'] });
      let ids = children.map(c => c.drive_id);
      for (const child of children) {
        ids = ids.concat(await getAllChildFolderIds(child.drive_id));
      }
      return ids;
    };
    const childIds = await getAllChildFolderIds(folderId);
    if (childIds.includes(destParentId)) throw new Error("Cannot move a folder into its own subfolder");
  }

  const duplicate = await Drive.findOne({ where: { name: folder.name, parent_id: destParentId, company_id: companyId }});
  if (duplicate) throw new Error("A folder with this name already exists in the destination");

  folder.parent_id = destParentId;
  await folder.save();

  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: userId,
      action: "MOVE", entity_type: "FOLDER", entity_id: folder.drive_id, entity_name: folder.name,
      details: `Moved folder to ${destParentId ? 'folder ' + destParentId : 'root'}`
    }).catch(e => console.error("Error logging activity", e));
  }

  return folder;
};

export const searchDriveService = async (query, companyId) => {
  const { Drive, DriveFile } = db.sequelize.models;
  const folders = await Drive.findAll({
    where: { name: { [Op.iLike]: `%${query}%` }, company_id: companyId },
    order: [["name", "ASC"]]
  });
  const files = await DriveFile.findAll({
    where: { original_name: { [Op.iLike]: `%${query}%` }, company_id: companyId },
    order: [["original_name", "ASC"]]
  });

  const formattedFolders = folders.map(f => ({
    id: f.drive_id, type: 'folder', name: f.name, parent_id: f.parent_id,
    created_at: f.created_at, updated_at: f.updated_at
  }));
  const formattedFiles = files.map(f => ({
    id: f.file_id, type: 'file', name: f.original_name, file_extension: f.file_extension,
    size: f.size, mime_type: f.mime_type, url: f.s3_key, parent_id: f.folder_id,
    created_at: f.created_at, updated_at: f.updated_at
  }));

  return { items: [...formattedFolders, ...formattedFiles] };
};

// --- STAGE A Enhancements ---

export const getTrashService = async (companyId) => {
  const { Drive, DriveFile } = db.sequelize.models;
  const folders = await Drive.findAll({
    where: { company_id: companyId, deleted_at: { [Op.not]: null } },
    paranoid: false,
    order: [["deleted_at", "DESC"]]
  });
  const files = await DriveFile.findAll({
    where: { company_id: companyId, deleted_at: { [Op.not]: null } },
    paranoid: false,
    order: [["deleted_at", "DESC"]]
  });

  const formattedFolders = folders.map(f => ({
    id: f.drive_id, type: 'folder', name: f.name, parent_id: f.parent_id,
    created_at: f.created_at, updated_at: f.updated_at, deleted_at: f.deleted_at
  }));
  const formattedFiles = files.map(f => ({
    id: f.file_id, type: 'file', name: f.original_name, file_extension: f.file_extension,
    size: f.size, mime_type: f.mime_type, url: f.s3_key, parent_id: f.folder_id,
    created_at: f.created_at, updated_at: f.updated_at, deleted_at: f.deleted_at
  }));

  return { items: [...formattedFolders, ...formattedFiles] };
};

export const restoreFolderService = async (folderId, companyId, userId) => {
  const { Drive, DriveFile, DriveActivityLog } = db.sequelize.models;
  const folder = await Drive.findOne({
    where: { drive_id: folderId, company_id: companyId },
    paranoid: false
  });

  if (!folder || !folder.deleted_at) {
    throw new Error("Folder not found in trash.");
  }

  const transaction = await db.sequelize.transaction();
  try {
    // Restore the folder
    await folder.restore({ transaction });

    // Recursively find all child folder IDs that were deleted at the same time (optional, but good practice)
    // For simplicity, we just restore all children that have deletedAt NOT NULL.
    const getAllChildFolderIds = async (parentId) => {
      const children = await Drive.findAll({
        where: { parent_id: parentId, company_id: companyId },
        attributes: ['drive_id'],
        paranoid: false,
        transaction
      });
      let ids = children.map(c => c.drive_id);
      for (const child of children) {
        ids = ids.concat(await getAllChildFolderIds(child.drive_id));
      }
      return ids;
    };

    const childFolderIds = await getAllChildFolderIds(folderId);
    const allFolderIds = [folderId, ...childFolderIds];

    await Drive.restore({ where: { drive_id: allFolderIds }, transaction });
    await DriveFile.restore({ where: { folder_id: allFolderIds }, transaction });

    await transaction.commit();

    if (DriveActivityLog) {
      await DriveActivityLog.create({
        company_id: companyId, user_id: userId,
        action: "RESTORE", entity_type: "FOLDER", entity_id: folderId, entity_name: folder.name
      }).catch(e => console.error("Error logging activity", e));
    }
    return folder;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const restoreFileService = async (fileId, companyId, userId) => {
  const { DriveFile, DriveActivityLog } = db.sequelize.models;
  const file = await DriveFile.findOne({
    where: { file_id: fileId, company_id: companyId },
    paranoid: false
  });

  if (!file || !file.deleted_at) {
    throw new Error("File not found in trash.");
  }

  await file.restore();

  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: userId,
      action: "RESTORE", entity_type: "FILE", entity_id: fileId, entity_name: file.original_name
    }).catch(e => console.error("Error logging activity", e));
  }
  return file;
};

export const emptyTrashService = async (companyId, userId) => {
  const { Drive, DriveFile, DriveActivityLog } = db.sequelize.models;

  const filesToDelete = await DriveFile.findAll({
    where: { company_id: companyId, deleted_at: { [Op.not]: null } },
    attributes: ['s3_key', 'file_id'],
    paranoid: false
  });
  
  const s3Keys = filesToDelete.map(f => f.s3_key);
  if (s3Keys.length > 0) {
    await deleteObjects(s3Keys);
  }

  await DriveFile.destroy({
    where: { company_id: companyId, deleted_at: { [Op.not]: null } },
    force: true
  });
  await Drive.destroy({
    where: { company_id: companyId, deleted_at: { [Op.not]: null } },
    force: true
  });

  if (DriveActivityLog) {
    await DriveActivityLog.create({
      company_id: companyId, user_id: userId,
      action: "EMPTY_TRASH", entity_type: "FOLDER", entity_name: "Trash"
    }).catch(e => console.error("Error logging activity", e));
  }
};

export const toggleStarFolderService = async (folderId, companyId) => {
  const { Drive } = db.sequelize.models;
  const folder = await Drive.findOne({ where: { drive_id: folderId, company_id: companyId } });
  if (!folder) throw new Error("Folder not found.");
  
  folder.is_starred = !folder.is_starred;
  await folder.save();
  return folder;
};

export const toggleStarFileService = async (fileId, companyId) => {
  const { DriveFile } = db.sequelize.models;
  const file = await DriveFile.findOne({ where: { file_id: fileId, company_id: companyId } });
  if (!file) throw new Error("File not found.");
  
  file.is_starred = !file.is_starred;
  await file.save();
  return file;
};

export const getStarredService = async (companyId) => {
  const { Drive, DriveFile } = db.sequelize.models;
  const folders = await Drive.findAll({
    where: { company_id: companyId, is_starred: true },
    order: [["name", "ASC"]]
  });
  const files = await DriveFile.findAll({
    where: { company_id: companyId, is_starred: true },
    order: [["original_name", "ASC"]]
  });

  const formattedFolders = folders.map(f => ({
    id: f.drive_id, type: 'folder', name: f.name, parent_id: f.parent_id,
    is_starred: f.is_starred, created_at: f.created_at, updated_at: f.updated_at
  }));
  const formattedFiles = files.map(f => ({
    id: f.file_id, type: 'file', name: f.original_name, file_extension: f.file_extension,
    is_starred: f.is_starred, size: f.size, mime_type: f.mime_type, url: f.s3_key, parent_id: f.folder_id,
    created_at: f.created_at, updated_at: f.updated_at
  }));

  return { items: [...formattedFolders, ...formattedFiles] };
};

export const getRecentFilesService = async (companyId) => {
  const { DriveFile } = db.sequelize.models;
  const files = await DriveFile.findAll({
    where: { company_id: companyId },
    order: [["created_at", "DESC"]],
    limit: 20
  });

  const formattedFiles = files.map(f => ({
    id: f.file_id, type: 'file', name: f.original_name, file_extension: f.file_extension,
    is_starred: f.is_starred, size: f.size, mime_type: f.mime_type, url: f.s3_key, parent_id: f.folder_id,
    created_at: f.created_at, updated_at: f.updated_at
  }));

  return { items: formattedFiles };
};

export const getStorageStatsService = async (companyId) => {
  const { DriveFile } = db.sequelize.models;
  const sum = await DriveFile.sum('size', { where: { company_id: companyId } });
  const count = await DriveFile.count({ where: { company_id: companyId } });
  return { total_bytes: sum || 0, total_files: count };
};

export const getFolderBreadcrumbsService = async (folderId, companyId) => {
  const { Drive } = db.sequelize.models;
  const breadcrumbs = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await Drive.findOne({ where: { drive_id: currentId, company_id: companyId } });
    if (!folder) break;
    breadcrumbs.unshift({ id: folder.drive_id, name: folder.name });
    currentId = folder.parent_id;
  }

  return { breadcrumbs };
};
