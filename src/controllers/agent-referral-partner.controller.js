const agentReferralPartnerService = require("../services/agent-referral-partner.service");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const getPool = require("../config/database");

module.exports.createAgentReferralPartner = async (req, res) => {
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

    return successResponse(
      res,
      keysToCamelCase(data),
      "Agent referral partner created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    return errorResponse(res, err.status || 500, err.message);
  } finally {
    client.release();
  }
};

module.exports.getAgentReferralPartnerById = async (req, res) => {
  try {
    const { partner_id } = req.params;
    const data =
      await agentReferralPartnerService.getAgentReferralPartnerById(partner_id);

    return successResponse(
      res,
      keysToCamelCase(data),
      "Agent referral partner retrieved successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.getAgentReferralPartners = async (req, res) => {
  try {
    const data = await agentReferralPartnerService.getAgentReferralPartners(
      req.user,
      req.query,
    );

    return successResponse(
      res,
      data,
      "Agent referral partners retrieved successfully.",
    );
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message);
  }
};

module.exports.updateAgentReferralPartner = async (req, res) => {
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

    return successResponse(
      res,
      keysToCamelCase(data),
      "Agent referral partner updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    return errorResponse(res, err.status || 500, err.message);
  } finally {
    client.release();
  }
};

module.exports.deleteAgentReferralPartner = async (req, res) => {
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
};
