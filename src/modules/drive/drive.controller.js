import * as driveService from "./drive.service.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { reorderItemsService } from "./drive-reorder.service.js";
import { getThumbnailUrlService } from "./drive-thumbnail.service.js";
import { keysToCamelCase } from "../../utils/common.js";

// --- Folder APIs ---

// 1. Create folder flow
export const createFolder = async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.users_id;

    if (!name) {
      return errorResponse(res, 400, "Folder name is required.");
    }

    const folder = await driveService.createFolderService({
      name,
      parent_id,
      company_id: companyId,
      builder_id: builderId,
      created_by: userId,
      updated_by: userId
    });

    return successResponse(res, keysToCamelCase(folder), "Folder created successfully.", 201);
  } catch (error) {
    console.error("Error creating folder:", error);
    return errorResponse(res, 400, error.message);
  }
};

// 3. Read folder content flow
export const getFolderContents = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const folderId = id === "root" ? null : id;

    const contents = await driveService.getFolderContentsService(folderId, companyId, builderId);

    return successResponse(res, keysToCamelCase(contents), "Folder contents fetched successfully.");
  } catch (error) {
    console.error("Error fetching folder contents:", error);
    return errorResponse(res, 500, "Failed to fetch folder contents.");
  }
};

export const getRootFolders = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const folders = await driveService.getRootFoldersService(companyId, builderId);
    return successResponse(res, keysToCamelCase(folders), "Root folders fetched successfully.");
  } catch (error) {
    console.error("Error fetching root folders:", error);
    return errorResponse(res, 500, "Failed to fetch root folders.");
  }
};

export const renameFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!name) {
      return errorResponse(res, 400, "New folder name is required.");
    }

    const updatedFolder = await driveService.renameFolderService(id, name, companyId, userId);
    return successResponse(res, keysToCamelCase(updatedFolder), "Folder renamed successfully.");
  } catch (error) {
    console.error("Error renaming folder:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    await driveService.deleteFolderService(id, companyId);
    return successResponse(res, null, "Folder deleted successfully.");
  } catch (error) {
    console.error("Error deleting folder:", error);
    return errorResponse(res, 400, error.message);
  }
};

// --- File APIs ---

// 2. Upload file flow
export const uploadFile = async (req, res) => {
  try {
    const { folder_id } = req.body;
    const file = req.file;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.users_id;

    if (!file) {
      return errorResponse(res, 400, "File is required.");
    }

    const uploadedFile = await driveService.uploadFileService(file, {
      folder_id: folder_id === "root" ? null : folder_id,
      company_id: companyId,
      builder_id: builderId,
      uploaded_by: userId
    });

    return successResponse(res, keysToCamelCase(uploadedFile), "File uploaded successfully.", 201);
  } catch (error) {
    console.error("Error uploading file:", error);
    return errorResponse(res, 500, error.message);
  }
};

export const getFilesInFolder = async (req, res) => {
  try {
    const { folder_id } = req.query;
    const companyId = req.user?.company_id;

    const files = await driveService.getFilesService(folder_id, companyId);
    return successResponse(res, keysToCamelCase(files), "Files fetched successfully.");
  } catch (error) {
    console.error("Error fetching files:", error);
    return errorResponse(res, 500, "Failed to fetch files.");
  }
};

export const renameFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { original_name } = req.body;
    const companyId = req.user?.company_id;

    if (!original_name) {
      return errorResponse(res, 400, "New file name is required.");
    }

    const updatedFile = await driveService.renameFileService(id, original_name, companyId);
    return successResponse(res, keysToCamelCase(updatedFile), "File renamed successfully.");
  } catch (error) {
    console.error("Error renaming file:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    await driveService.deleteFileService(id, companyId);
    return successResponse(res, null, "File deleted successfully.");
  } catch (error) {
    console.error("Error deleting file:", error);
    return errorResponse(res, 400, error.message);
  }
};
export const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    const downloadUrl = await driveService.getDownloadUrlService(id, companyId);
    return successResponse(res, keysToCamelCase({ url: downloadUrl }), "Download URL generated successfully.", 200);
  } catch (error) {
    console.error("Error downloading file:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const moveFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_folder_id } = req.body;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const file = await driveService.moveFileService(id, new_folder_id, companyId, userId);
    return successResponse(res, keysToCamelCase(file), "File moved successfully.", 200);
  } catch (error) {
    console.error("Error moving file:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const moveFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_parent_id } = req.body;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const folder = await driveService.moveFolderService(id, new_parent_id, companyId, userId);
    return successResponse(res, keysToCamelCase(folder), "Folder moved successfully.", 200);
  } catch (error) {
    console.error("Error moving folder:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const searchDrive = async (req, res) => {
  try {
    const { q } = req.query;
    const companyId = req.user?.company_id;

    if (!q) {
      return errorResponse(res, 400, "Search query 'q' is required.");
    }

    const results = await driveService.searchDriveService(q, companyId);
    return successResponse(res, keysToCamelCase(results), "Search results fetched successfully.", 200);
  } catch (error) {
    console.error("Error searching drive:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const getTrash = async (req, res) => {
  try {
    const results = await driveService.getTrashService(req.user?.company_id);
    return successResponse(res, keysToCamelCase(results), "Trash items fetched.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const restoreFolder = async (req, res) => {
  try {
    const folder = await driveService.restoreFolderService(req.params.id, req.user?.company_id, req.user?.users_id);
    return successResponse(res, keysToCamelCase(folder), "Folder restored.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const restoreFile = async (req, res) => {
  try {
    const file = await driveService.restoreFileService(req.params.id, req.user?.company_id, req.user?.users_id);
    return successResponse(res, keysToCamelCase(file), "File restored.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const emptyTrash = async (req, res) => {
  try {
    await driveService.emptyTrashService(req.user?.company_id, req.user?.users_id);
    return successResponse(res, null, "Trash emptied.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const toggleStarFolder = async (req, res) => {
  try {
    const folder = await driveService.toggleStarFolderService(req.params.id, req.user?.company_id);
    return successResponse(res, keysToCamelCase(folder), "Folder star toggled.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const toggleStarFile = async (req, res) => {
  try {
    const file = await driveService.toggleStarFileService(req.params.id, req.user?.company_id);
    return successResponse(res, keysToCamelCase(file), "File star toggled.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const getStarred = async (req, res) => {
  try {
    const results = await driveService.getStarredService(req.user?.company_id);
    return successResponse(res, keysToCamelCase(results), "Starred items fetched.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const getRecentFiles = async (req, res) => {
  try {
    const results = await driveService.getRecentFilesService(req.user?.company_id);
    return successResponse(res, keysToCamelCase(results), "Recent files fetched.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const getStorageStats = async (req, res) => {
  try {
    const stats = await driveService.getStorageStatsService(req.user?.company_id);
    return successResponse(res, keysToCamelCase(stats), "Storage stats fetched.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const getFolderBreadcrumbs = async (req, res) => {
  try {
    const breadcrumbs = await driveService.getFolderBreadcrumbsService(req.params.id, req.user?.company_id);
    return successResponse(res, keysToCamelCase(breadcrumbs), "Breadcrumbs fetched.", 200);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

// --- Stage C2: Reorder ---
export const reorderItems = async (req, res) => {
  try {
    const { items, parent_id } = req.body;
    const companyId = req.user?.company_id;
    if (!items || !Array.isArray(items)) {
      return errorResponse(res, 400, "'items' array is required.");
    }
    const result = await reorderItemsService(items, parent_id, companyId);
    return successResponse(res, keysToCamelCase(result), "Items reordered.", 200);
  } catch (error) {
    console.error("[Reorder] Error:", error);
    return errorResponse(res, 400, error.message);
  }
};

// --- Stage C3: Thumbnail ---
export const getFileThumbnail = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const result = await getThumbnailUrlService(id, companyId);
    return successResponse(res, keysToCamelCase(result), "Thumbnail URL fetched.", 200);
  } catch (error) {
    console.error("[Thumbnail] Error:", error);
    return errorResponse(res, 400, error.message);
  }
};
