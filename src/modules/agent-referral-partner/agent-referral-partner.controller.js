import agentReferralPartnerService from "./agent-referral-partner.service.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import getPool from "../../config/database.js";

export async function createAgentReferralPartner(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const data = await agentReferralPartnerService.createAgentReferralPartner(
      req.user,
      req.body,
      client,
    );

    await client.query("COMMIT");

    // Transform response to match get all API structure
    const transformedData =
      await agentReferralPartnerService.transformAgentReferralPartnerResponse(
        data,
      );

    return successResponse(
      res,
      transformedData,
      "Agent referral partner created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    return errorResponse(res, err.status || 500, err.message);
  } finally {
    client.release();
  }
}

export async function getAgentReferralPartnerById(req, res) {
  try {
    const { partner_id } = req.params;
    const data =
      await agentReferralPartnerService.getAgentReferralPartnerById(partner_id);

    // Transform response to match get all API structure
    const transformedData =
      await agentReferralPartnerService.transformAgentReferralPartnerResponse(
        data,
      );

    return successResponse(
      res,
      transformedData,
      "Agent referral partner retrieved successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
}

export async function getAgentReferralPartners(req, res) {
  try {
    const { page = 1, limit = 25 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const data = await agentReferralPartnerService.getAgentReferralPartners(
      req.user,
      req.query,
    );

    const totalPages = Math.ceil(data.total / limitNum);

    return successResponse(
      res,
      data.data,
      "Agent referral partners retrieved successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
}

export async function updateAgentReferralPartner(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { partner_id } = req.params;

    await client.query("BEGIN");

    const data = await agentReferralPartnerService.updateAgentReferralPartner(
      req.user,
      partner_id,
      req.body,
      client,
    );

    await client.query("COMMIT");

    // Transform response to match get all API structure
    const transformedData =
      await agentReferralPartnerService.transformAgentReferralPartnerResponse(
        data,
      );

    return successResponse(
      res,
      transformedData,
      "Agent referral partner updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    return errorResponse(res, err.status || 500, err.message);
  } finally {
    client.release();
  }
}

export async function deleteAgentReferralPartner(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { partner_id } = req.params;

    await client.query("BEGIN");

    const data = await agentReferralPartnerService.deleteAgentReferralPartner(
      req.user,
      partner_id,
      client,
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(data),
      "Agent referral partner deleted successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    return errorResponse(res, err.status || 500, err.message);
  } finally {
    client.release();
  }
}

export default {
  createAgentReferralPartner,
  getAgentReferralPartnerById,
  getAgentReferralPartners,
  updateAgentReferralPartner,
  deleteAgentReferralPartner,
};