import { successResponse, errorResponse } from "../../helper/response.js";
import {
  createDocumentCommonFolderService,
  getAllDocumentCommonFoldersService,
  deleteDocumentCommonFolderService,
  updateDocumentCommonFolderService,
} from "./document-common-folder.service.js";

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createDocumentCommonFolder(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 400, "Invalid user context. Missing builder or company ID.");
    }

    const {
      name,
      sort_order,
      notify,
      share_to_customer,
      is_locked,
      role_ids,
      user_ids,
    } = req.body;

    const result = await createDocumentCommonFolderService({
      builderId,
      companyId,
      createdBy,
      name,
      sort_order,
      notify,
      share_to_customer,
      is_locked,
      role_ids,
      user_ids,
    });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, result.data, "Document common folder created successfully.");
  } catch (error) {
    console.error("Error creating document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  }
}

// ─── GET ALL ──────────────────────────────────────────────────────────────────

export async function getAllDocumentCommonFolders(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 400, "Invalid user context. Missing builder or company ID.");
    }

    const result = await getAllDocumentCommonFoldersService({ builderId, companyId });

    return successResponse(
      res,
      result.data,
      "Document common folders with subfolders fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching document common folders:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteDocumentCommonFolder(req, res) {
  try {
    const { document_common_folder_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!document_common_folder_id) {
      return errorResponse(res, 400, "Document common folder ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(res, 400, "Invalid user context. Missing builder or company ID.");
    }

    const result = await deleteDocumentCommonFolderService({
      document_common_folder_id,
      builderId,
      companyId,
    });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, null, "Document common folder deleted successfully.");
  } catch (error) {
    console.error("Error deleting document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateDocumentCommonFolder(req, res) {
  try {
    const { document_common_folder_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const updatedBy = req.user?.users_id;

    if (!document_common_folder_id) {
      return errorResponse(res, 400, "Document common folder ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(res, 400, "Invalid user context. Missing builder or company ID.");
    }

    const {
      name,
      sort_order,
      notify,
      share_to_customer,
      is_locked,
      role_ids,
      user_ids,
    } = req.body;

    const result = await updateDocumentCommonFolderService({
      document_common_folder_id,
      builderId,
      companyId,
      updatedBy,
      name,
      sort_order,
      notify,
      share_to_customer,
      is_locked,
      role_ids,
      user_ids,
    });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, result.data, "Document common folder updated successfully.");
  } catch (error) {
    console.error("Error updating document common folder:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  }
}
