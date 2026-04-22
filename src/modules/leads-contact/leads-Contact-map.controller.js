import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";

export async function createLeadContactMap(req, res) {
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
      [leads_id, builderId, companyId],
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    await checkLeadLockStatus(leads_id);

    const contactCheck = await client.query(
      `SELECT u.users_id, u.name, u.email, u.phone, u.secondary_phone, u.remark, u.role_id, u.address_id, u.has_login, u.is_active, u.created_at, u.updated_at, r.name as role_name,
              jsonb_build_object(
                'address_line1', a.address_line1,
                'address_line2', a.address_line2,
                'city', a.city,
                'zip_code', a.zip_code,
                'country_id', a.country_id,
                'state_id', a.state_id
              ) AS address
       FROM users u
       JOIN role r ON u.role_id = r.role_id
       LEFT JOIN address a ON a.address_id = u.address_id
       WHERE u.users_id = $1 AND u.is_deleted = false LIMIT 1`,
      [contact_id],
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
      "SELECT id FROM leads_contact_map WHERE leads_id = $1 AND contact_id = $2 LIMIT 1",
      [leads_id, contact_id],
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 409, "This contact is already mapped to the lead");
    }

    // Check if the lead already has 2 contacts
    const countCheck = await client.query(
      "SELECT COUNT(*) FROM leads_contact_map WHERE leads_id = $1",
      [leads_id],
    );

    if (parseInt(countCheck.rows[0].count) >= 2) {
      return errorResponse(res, 400, "A lead can have a maximum of 2 contacts.");
    }

    const result = await client.query(
      `INSERT INTO leads_contact_map (leads_id, contact_id)
       VALUES ($1, $2) RETURNING *`,
      [leads_id, contact_id],
    );

    const contact = contactCheck.rows[0];
    const rawResult = result.rows[0];
    const { created_at, updated_at, ...restResult } = rawResult;

    const responseData = keysToCamelCase({
      ...restResult,
      users_id: contact.users_id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      secondary_phone: contact.secondary_phone,
      remark: contact.remark,
      role_id: contact.role_id,
      address_id: contact.address_id,
      has_login: contact.has_login,
      is_active: contact.is_active,
      address: contact.address,
      contact_created_at: contact.created_at,
      contact_updated_at: contact.updated_at,
      created_at,
      updated_at,
    });

    return successResponse(res, responseData, 201, "Contact mapped to lead successfully");
  } catch (error) {
    console.error("Create lead contact map error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function getContactsByLeadId(req, res) {
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
      [leads_id, builderId, companyId],
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    const result = await client.query(
      `SELECT m.id, m.leads_id, m.contact_id, m.created_at, m.updated_at,
              u.users_id as contact_users_id, u.name as contact_name, u.email as contact_email, u.phone as contact_phone,
              u.secondary_phone as contact_secondary_phone, u.remark as contact_remark,
              u.role_id as contact_role_id, u.address_id as contact_address_id,
              u.has_login as contact_has_login, u.is_active as contact_is_active,
              u.created_at as contact_created_at, u.updated_at as contact_updated_at,
              jsonb_build_object(
                'address_line1', a.address_line1,
                'address_line2', a.address_line2,
                'city', a.city,
                'zip_code', a.zip_code,
                'country_id', a.country_id,
                'state_id', a.state_id
              ) AS contact_address
       FROM leads_contact_map m
       JOIN users u ON m.contact_id = u.users_id
       LEFT JOIN address a ON a.address_id = u.address_id
       WHERE m.leads_id = $1
       ORDER BY m.created_at ASC`,
      [leads_id],
    );

    const formattedData = result.rows.map(row => {
      const {
        id, leads_id, contact_id, created_at, updated_at,
        contact_users_id, contact_name, contact_email, contact_phone,
        contact_secondary_phone, contact_remark, contact_role_id,
        contact_address_id, contact_has_login, contact_is_active,
        contact_created_at, contact_updated_at, contact_address,
      } = row;

      return keysToCamelCase({
        id, leads_id, contact_id,
        users_id: contact_users_id,
        name: contact_name,
        email: contact_email,
        phone: contact_phone,
        secondary_phone: contact_secondary_phone,
        remark: contact_remark,
        role_id: contact_role_id,
        address_id: contact_address_id,
        has_login: contact_has_login,
        is_active: contact_is_active,
        address: contact_address,
        contact_created_at,
        contact_updated_at,
        created_at,
        updated_at,
      });
    });

    return successResponse(
      res,
      formattedData,
      "Lead contacts fetched successfully"
    );
  } catch (error) {
    console.error("Get lead contacts error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function deleteLeadContactMap(req, res) {
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
      `SELECT m.id, m.leads_id FROM leads_contact_map m
       JOIN leads l ON m.leads_id = l.leads_id
       WHERE m.id = $1 AND (
         (l.builder_id = $2 AND $2 IS NOT NULL)
         OR (l.company_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, builderId, companyId],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Lead contact mapping not found or does not belong to your organization");
    }

    await checkLeadLockStatus(checkResult.rows[0].leads_id);

    await client.query("DELETE FROM leads_contact_map WHERE id = $1", [id]);

    return successResponse(res, null, "Lead contact mapping deleted successfully");
  } catch (error) {
    console.error("Delete lead contact map error:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export default {
  createLeadContactMap,
  getContactsByLeadId,
  deleteLeadContactMap,
};
