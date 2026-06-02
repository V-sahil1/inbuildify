import { successResponse, errorResponse } from "../../helper/response.js";
import * as versionService from "./drive-version.service.js";
import { keysToCamelCase } from "../../utils/common.js";

export const uploadNewVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!req.file) return errorResponse(res, 400, "No file uploaded.");

    const result = await versionService.uploadNewVersionService(id, req.file, companyId, userId);
    return successResponse(res, keysToCamelCase(result), "New version uploaded successfully.", 201);
  } catch (error) {
    console.error("[Versions] uploadNewVersion error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const getFileVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    const result = await versionService.getFileVersionsService(id, companyId);
    return successResponse(res, keysToCamelCase(result), "File versions fetched.", 200);
  } catch (error) {
    console.error("[Versions] getFileVersions error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const getVersionDownloadUrl = async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const companyId = req.user?.company_id;

    const url = await versionService.getVersionDownloadUrlService(id, versionId, companyId);
    return successResponse(res, keysToCamelCase({ url }), "Version download URL generated.", 200);
  } catch (error) {
    console.error("[Versions] getVersionDownloadUrl error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const restoreVersion = async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const result = await versionService.restoreVersionService(id, versionId, companyId, userId);
    return successResponse(res, keysToCamelCase(result), "Version restored as current.", 200);
  } catch (error) {
    console.error("[Versions] restoreVersion error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const deleteVersion = async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    await versionService.deleteVersionService(id, versionId, companyId, userId);
    return successResponse(res, null, "Version deleted.", 200);
  } catch (error) {
    console.error("[Versions] deleteVersion error:", error);
    return errorResponse(res, 400, error.message);
  }
};
