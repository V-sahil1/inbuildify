const getPool = require("../config/database");

async function createAgentReferralPartner(data, client = getPool()) {
  const {
    company_id,
    builder_id,
    user_id,
    address_id,
    account_name,
    account_bsb,
    account_number,
    abn,
    company_name,
    referred_user_id,
    created_by,
  } = data;

  const result = await client.query(
    `INSERT INTO agent_referral_partner (
      company_id, builder_id, user_id, address_id,
      account_name, account_bsb, account_number, abn, company_name,
      referred_user_id, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) RETURNING agent_referral_partner_id, company_id, builder_id, user_id, address_id, account_name, account_bsb, account_number, abn, company_name, referred_user_id, created_by, updated_by, created_at, updated_at`,
    [
      company_id,
      builder_id,
      user_id,
      address_id,
      account_name,
      account_bsb,
      account_number,
      abn,
      company_name,
      referred_user_id,
      created_by,
    ],
  );

  return result.rows[0];
}

async function getAgentReferralPartnerById(partnerId, client = getPool()) {
  const result = await client.query(
    `SELECT 
      arp.*,
      a.address_line1, a.address_line2, a.city, a.state_id, a.country_id, a.zip_code,
      u.name as referred_user_name, u.email as referred_user_email,
      creator.name as created_by_name
    FROM agent_referral_partner arp
    LEFT JOIN address a ON arp.address_id = a.address_id
    LEFT JOIN users u ON arp.referred_user_id = u.users_id
    LEFT JOIN users creator ON arp.created_by = creator.users_id
    WHERE arp.agent_referral_partner_id = $1`,
    [partnerId],
  );

  return result.rows[0] || null;
}

async function getAgentReferralPartnersByBuilder(
  builderId,
  query,
  client = getPool(),
) {
  const { page = 1, limit = 25, search = "" } = query;
  const offset = (page - 1) * limit;

  let whereClause = "WHERE arp.builder_id = $1";
  let countWhereClause = "WHERE arp.builder_id = $1";
  let values = [builderId];
  let countValues = [builderId];

  if (search) {
    whereClause += ` AND (
      arp.name ILIKE $2 OR 
      arp.email ILIKE $2 OR 
      arp.phone ILIKE $2 OR 
      arp.company_name ILIKE $2
    )`;
    countWhereClause += ` AND (
      arp.name ILIKE $2 OR 
      arp.email ILIKE $2 OR 
      arp.phone ILIKE $2 OR 
      arp.company_name ILIKE $2
    )`;
    values.push(`%${search}%`);
    countValues.push(`%${search}%`);
  }

  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM agent_referral_partner arp ${countWhereClause}`,
    countValues,
  );

  const result = await client.query(
    `SELECT 
      arp.*,
      a.address_line1, a.address_line2, a.city, a.state_id, a.country_id, a.zip_code,
      u.name as referred_user_name, u.email as referred_user_email,
      creator.name as created_by_name
    FROM agent_referral_partner arp
    LEFT JOIN address a ON arp.address_id = a.address_id
    LEFT JOIN users u ON arp.referred_user_id = u.users_id
    LEFT JOIN users creator ON arp.created_by = creator.users_id
    ${whereClause}
    ORDER BY arp.created_at DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].total),
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

async function getAgentReferralPartnersByCompany(
  companyId,
  query,
  client = getPool(),
) {
  const { page = 1, limit = 25, search = "" } = query;
  const offset = (page - 1) * limit;

  let whereClause = "WHERE arp.company_id = $1";
  let countWhereClause = "WHERE arp.company_id = $1";
  let values = [companyId];
  let countValues = [companyId];

  if (search) {
    whereClause += ` AND (
      arp.name ILIKE $2 OR 
      arp.email ILIKE $2 OR 
      arp.phone ILIKE $2 OR 
      arp.company_name ILIKE $2
    )`;
    countWhereClause += ` AND (
      arp.name ILIKE $2 OR 
      arp.email ILIKE $2 OR 
      arp.phone ILIKE $2 OR 
      arp.company_name ILIKE $2
    )`;
    values.push(`%${search}%`);
    countValues.push(`%${search}%`);
  }

  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM agent_referral_partner arp ${countWhereClause}`,
    countValues,
  );

  const result = await client.query(
    `SELECT 
      arp.*,
      a.address_line1, a.address_line2, a.city, a.state_id, a.country_id, a.zip_code,
      u.name as referred_user_name, u.email as referred_user_email,
      creator.name as created_by_name
    FROM agent_referral_partner arp
    LEFT JOIN address a ON arp.address_id = a.address_id
    LEFT JOIN users u ON arp.referred_user_id = u.users_id
    LEFT JOIN users creator ON arp.created_by = creator.users_id
    ${whereClause}
    ORDER BY arp.created_at DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].total),
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

async function updateAgentReferralPartner(partnerId, data, client = getPool()) {
  const {
    address_id,
    account_name,
    account_bsb,
    account_number,
    abn,
    company_name,
    referred_user_id,
    updated_by,
  } = data;

  const result = await client.query(
    `UPDATE agent_referral_partner SET
      address_id = $2,
      account_name = $3,
      account_bsb = $4,
      account_number = $5,
      abn = $6,
      company_name = $7,
      referred_user_id = $8,
      updated_by = $9,
      updated_at = NOW()
    WHERE agent_referral_partner_id = $1
    RETURNING agent_referral_partner_id, company_id, builder_id, user_id, address_id, account_name, account_bsb, account_number, abn, company_name, referred_user_id, created_by, updated_by, created_at, updated_at`,
    [
      partnerId,
      address_id,
      account_name,
      account_bsb,
      account_number,
      abn,
      company_name,
      referred_user_id,
      updated_by,
    ],
  );

  return result.rows[0] || null;
}

async function deleteAgentReferralPartner(partnerId, client = getPool()) {
  // First, get the partner record to find the associated user_id
  const partnerResult = await client.query(
    "SELECT user_id FROM agent_referral_partner WHERE agent_referral_partner_id = $1",
    [partnerId],
  );

  if (partnerResult.rows.length === 0) {
    return null;
  }

  const userId = partnerResult.rows[0].user_id;

  const result = await client.query(
    `DELETE FROM agent_referral_partner WHERE agent_referral_partner_id = $1 RETURNING *`,
    [partnerId],
  );

  if (userId) {
    await client.query(
      "UPDATE users SET is_deleted = true WHERE users_id = $1",
      [userId],
    );
  }

  return result.rows[0] || null;
}

async function getAgentReferralPartnerByEmail(email, client = getPool()) {
  const result = await client.query(
    `SELECT arp.* FROM agent_referral_partner arp
     INNER JOIN users u ON arp.user_id = u.users_id 
     WHERE u.email = $1`,
    [email],
  );

  return result.rows[0] || null;
}

module.exports = {
  createAgentReferralPartner,
  getAgentReferralPartnerById,
  getAgentReferralPartnersByBuilder,
  getAgentReferralPartnersByCompany,
  updateAgentReferralPartner,
  deleteAgentReferralPartner,
  getAgentReferralPartnerByEmail,
};
