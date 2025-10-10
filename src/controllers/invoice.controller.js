const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { generateInvoiceCode } = require("../helper/codeGenerator");

const getUsersDetails = async (client, userIds) => {
  if (!userIds || userIds.length === 0) return {};
  
  const validUserIds = userIds.filter(Boolean);
  if (validUserIds.length === 0) return {};

  const usersQuery = `
    SELECT users_id, name 
    FROM users 
    WHERE users_id = ANY($1::uuid[])
  `;
  const usersResult = await client.query(usersQuery, [validUserIds]);
  
  return usersResult.rows.reduce((acc, row) => {
    acc[row.users_id] = row.name;
    return acc;
  }, {});
};

const formatUserObject = (userId, usersMap) => {
  if (!userId) return null;
  return {
    id: userId,
    name: usersMap[userId] || null
  };
};

exports.createInvoice = async (req, res) => {
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;
  const creatorName = req.user.name || "User";
  const {
    description,
    notes,
    invoice_amount = 0,
    due_date,
    status = "draft",
    version_number = 1,
  } = req.body;
  const lead_id = req.params.lead_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (lead_id) {
      const leadRes = await client.query(
        `SELECT lead_id FROM leads WHERE lead_id = $1 AND builder_id = $2 AND is_deleted = false`,
        [lead_id, builderId]
      );
      if (leadRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Lead not found.");
      }
    }

    const leadInvoiceId = generateInvoiceCode(creatorName, "invoice", version_number);

    const insertQuery = `
      INSERT INTO invoice (
        lead_invoice_id, builder_id, lead_id, description, notes,
        invoice_amount, due_date, status, version_number,
        created_by_id, updated_by_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `;

    const values = [
      leadInvoiceId,
      builderId,
      lead_id,
      description,
      notes,
      invoice_amount,
      due_date,
      status,
      version_number,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    
    const usersMap = await getUsersDetails(client, [userId]);
    const invoice = keysToCamelCase(result.rows[0]);
    
    invoice.createdBy = formatUserObject(result.rows[0].created_by_id, usersMap);
    invoice.updatedBy = formatUserObject(result.rows[0].updated_by_id, usersMap);
    
    delete invoice.createdById;
    delete invoice.updatedById;

    await client.query("COMMIT");

    return successResponse(
      res,
      invoice,
      "Invoice created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create invoice error:", error);
    if (error.code === "23505") {
      return errorResponse(res, 409, "Duplicate invoice code.");
    }
    return errorResponse(res, 500, "Failed to create invoice.");
  } finally {
    client.release();
  }
};

exports.getInvoices = async (req, res) => {
  const builderId = req.user.builder_id;
  const lead_id = req.params.lead_id;
  const { limit = 25, offset = 0, status } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    let where = [`builder_id = $1`, `is_deleted = false`];
    const params = [builderId];
    let idx = 2;

    if (lead_id) {
      where.push(`lead_id = $${idx++}`);
      params.push(lead_id);
    }
    if (status) {
      where.push(`status = $${idx++}`);
      params.push(status);
    }

    const query = `
      SELECT *
        FROM invoice
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}
    `;
    params.push(limit, offset);

    const result = await client.query(query, params);
    
    const userIds = new Set();
    result.rows.forEach(row => {
      if (row.created_by_id) userIds.add(row.created_by_id);
      if (row.updated_by_id) userIds.add(row.updated_by_id);
    });
    
    const usersMap = await getUsersDetails(client, Array.from(userIds));
    
    const invoices = result.rows.map(row => {
      const invoice = keysToCamelCase(row);
      invoice.createdBy = formatUserObject(row.created_by_id, usersMap);
      invoice.updatedBy = formatUserObject(row.updated_by_id, usersMap);
      
      delete invoice.createdById;
      delete invoice.updatedById;
      
      return invoice;
    });

    return successResponse(
      res,
      invoices,
      "Invoices fetched successfully."
    );
  } catch (error) {
    console.error("Get invoices error:", error);
    return errorResponse(res, 500, "Failed to fetch invoices.");
  } finally {
    client.release();
  }
};

exports.updateInvoice = async (req, res) => {
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;
  const invoice_id = req.params.invoice_id;
  const {
    description,
    notes,
    invoice_amount,
    due_date,
    status,
  } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkQuery = `
      SELECT invoice_id 
      FROM invoice 
      WHERE invoice_id = $1 AND builder_id = $2 AND is_deleted = false
    `;
    const checkResult = await client.query(checkQuery, [invoice_id, builderId]);
    
    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Invoice not found.");
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (invoice_amount !== undefined) {
      updates.push(`invoice_amount = $${idx++}`);
      values.push(invoice_amount);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${idx++}`);
      values.push(due_date);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }

    updates.push(`updated_by_id = $${idx++}`);
    values.push(userId);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(invoice_id, builderId);

    const updateQuery = `
      UPDATE invoice
      SET ${updates.join(", ")}
      WHERE invoice_id = $${idx++} AND builder_id = $${idx++} AND is_deleted = false
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);
    
    // Get user details for the response
    const userIds = [result.rows[0].created_by_id, result.rows[0].updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);
    
    const invoice = keysToCamelCase(result.rows[0]);
    invoice.createdBy = formatUserObject(result.rows[0].created_by_id, usersMap);
    invoice.updatedBy = formatUserObject(result.rows[0].updated_by_id, usersMap);
    
    delete invoice.createdById;
    delete invoice.updatedById;

    await client.query("COMMIT");

    return successResponse(
      res,
      invoice,
      "Invoice updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update invoice error:", error);
    return errorResponse(res, 500, "Failed to update invoice.");
  } finally {
    client.release();
  }
};
