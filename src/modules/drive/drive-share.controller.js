import { successResponse, errorResponse } from "../../helper/response.js";
import * as shareService from "./drive-share.service.js";
import { keysToCamelCase } from "../../utils/common.js";

export const createShare = async (req, res) => {
  try {
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const share = await shareService.createShareService(req.body, userId, companyId);
    const responseData = keysToCamelCase(share);
    if (responseData.entityType) responseData.entityType = responseData.entityType.toLowerCase();
    return successResponse(res, responseData, "Item shared successfully.", 201);
  } catch (error) {
    console.error("[Share] createShare error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const updateShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { permission_level } = req.body;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const share = await shareService.updateShareService(id, permission_level, userId, companyId);
    const responseData = keysToCamelCase(share);
    if (responseData.entityType) responseData.entityType = responseData.entityType.toLowerCase();
    return successResponse(res, responseData, "Share permission updated.", 200);
  } catch (error) {
    console.error("[Share] updateShare error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const deleteShare = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    await shareService.deleteShareService(id, userId, companyId);
    return successResponse(res, null, "Share revoked.", 200);
  } catch (error) {
    console.error("[Share] deleteShare error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const getSharedWithMe = async (req, res) => {
  try {
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const result = await shareService.getSharedWithMeService(userId, companyId);
    const responseData = keysToCamelCase(result);
    if (responseData.items) {
      responseData.items = responseData.items.map(item => ({
        ...item,
        entityType: item.entityType?.toLowerCase()
      }));
    }
    return successResponse(res, responseData, "Shared items fetched.", 200);
  } catch (error) {
    console.error("[Share] getSharedWithMe error:", error);
    return errorResponse(res, 400, error.message);
  }
};

export const getEntityShares = async (req, res) => {
  try {
    const { type, id } = req.params;
    const companyId = req.user?.company_id;
    const result = await shareService.getEntitySharesService(type, id, companyId);
    const responseData = keysToCamelCase(result);
    if (responseData.items) {
      responseData.items = responseData.items.map(item => ({
        ...item,
        entityType: item.entityType?.toLowerCase()
      }));
    }
    return successResponse(res, responseData, "Entity shares fetched.", 200);
  } catch (error) {
    console.error("[Share] getEntityShares error:", error);
    return errorResponse(res, 400, error.message);
  }
};
