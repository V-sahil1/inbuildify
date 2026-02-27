const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createLeadContactMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { leads_id, contact_id } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const leadCheck = await client.query(
      `SELECT leads_id FROM leads WHERE leads_id = $1 AND (
        (builder_id = $2 AND $2 IS NOT NULL)
        OR (company_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [leads_id, builderId, companyId]
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    const contactCheck = await client.query(
      `SELECT u.users_id, u.name, u.email, u.phone, u.is_active, r.name as role_name
       FROM users u
       JOIN role r ON u.role_id = r.role_id
       WHERE u.users_id = $1 AND u.is_deleted = false LIMIT 1`,
      [contact_id]
    );

    if (contactCheck.rowCount === 0) {
      return errorResponse(res, 404, "Contact not found or does not belong to your organization");
    }

    if (contactCheck.rows[0].is_active !== true) {
      return errorResponse(res, 400, "Contact is inactive");
    }

    if (contactCheck.rows[0].role_name !== "Contact") {
      return errorResponse(res, 400, "The provided user does not have the Contact role");
    }

    const duplicateCheck = await client.query(
      `SELECT id FROM leads_contact_map WHERE leads_id = $1 AND contact_id = $2 LIMIT 1`,
      [leads_id, contact_id]
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 409, "This contact is already mapped to the lead");
    }

    const result = await client.query(
      `INSERT INTO leads_contact_map (leads_id, contact_id)
       VALUES ($1, $2) RETURNING *`,
      [leads_id, contact_id]
    );

    const contact = contactCheck.rows[0];
    const responseData = {
      ...keysToCamelCase(result.rows[0]),
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
    };

    return successResponse(res, responseData, 201, "Contact mapped to lead successfully");
  } catch (error) {
    console.error("Create lead contact map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getContactsByLeadId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const leadCheck = await client.query(
      `SELECT leads_id FROM leads WHERE leads_id = $1 AND (
        (builder_id = $2 AND $2 IS NOT NULL)
        OR (company_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [leads_id, builderId, companyId]
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    const result = await client.query(
      `SELECT m.id, m.leads_id, m.contact_id, m.created_at, m.updated_at,
              u.name as contact_name, u.email as contact_email, u.phone as contact_phone
       FROM leads_contact_map m
       JOIN users u ON m.contact_id = u.users_id
       WHERE m.leads_id = $1
       ORDER BY m.created_at ASC`,
      [leads_id]
    );

    return successResponse(
      res,
      result.rows.map(row => keysToCamelCase(row)),
      "Lead contacts fetched successfully"
    );
  } catch (error) {
    console.error("Get lead contacts error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteLeadContactMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const checkResult = await client.query(
      `SELECT m.id FROM leads_contact_map m
       JOIN leads l ON m.leads_id = l.leads_id
       WHERE m.id = $1 AND (
         (l.builder_id = $2 AND $2 IS NOT NULL)
         OR (l.company_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, builderId, companyId]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Lead contact mapping not found or does not belong to your organization");
    }

    await client.query("DELETE FROM leads_contact_map WHERE id = $1", [id]);

    return successResponse(res, null, "Lead contact mapping deleted successfully");
  } catch (error) {
    console.error("Delete lead contact map error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
