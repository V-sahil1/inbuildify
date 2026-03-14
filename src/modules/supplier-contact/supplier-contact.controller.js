const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createSupplierContact = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    const { supplier_id, contact_name, email, phone, contact_type } = req.body;

    await client.query("BEGIN");

    const supplierRes = await client.query(
      `SELECT supplier_id, builder_id 
       FROM supplier 
       WHERE supplier_id = $1`,
      [supplier_id],
    );

    if (
      supplierRes.rowCount === 0 ||
      supplierRes.rows[0].builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Supplier does not belong to this builder.",
      );
    }

    if (supplier_id) {
      const supplierCheck = await client.query(
        `SELECT supplier_id 
     FROM supplier 
     WHERE builder_id = $1 
       AND supplier_id = $2 
       AND status = true`,
        [builderId, supplier_id],
      );

      if (supplierCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "supplier id is inactive.");
      }
    }

    if (email) {
      if (typeof email !== "string" || !email.includes("@")) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid email format.");
      }
    }

    const insertQuery = `
      INSERT INTO supplier_contacts 
        (supplier_id, contact_name, email, phone, contact_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      supplier_id,
      contact_name,
      email || null,
      phone || null,
      contact_type || null,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier contact created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating supplier contact:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllSupplierContacts = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    let { supplier_id } = req.query;

    let conditions = [];
    let values = [];
    let index = 1;

    conditions.push(`s.builder_id = $${index++}`);
    values.push(builderId);

    if (supplier_id) {
      conditions.push(`sc.supplier_id = $${index++}`);
      values.push(supplier_id);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const dataQuery = `
      SELECT sc.*
      FROM supplier_contacts sc
      JOIN supplier s ON sc.supplier_id = s.supplier_id
      ${whereClause}
      ORDER BY sc.created_at DESC
    `;

    const result = await client.query(dataQuery, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Supplier contacts fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching supplier contacts:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSupplierContact = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { supplier_contact_id } = req.params;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT sc.supplier_contact_id
      FROM supplier_contacts sc
      JOIN supplier s ON sc.supplier_id = s.supplier_id
      WHERE sc.supplier_contact_id = $1
        AND s.builder_id = $2
      LIMIT 1;
    `;

    const checkResult = await client.query(checkQuery, [
      supplier_contact_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or does not belong to this builder.",
      );
    }

    const deleteQuery = `
      DELETE FROM supplier_contacts
      WHERE supplier_contact_id = $1;
    `;

    await client.query(deleteQuery, [supplier_contact_id]);

    return successResponse(res, {}, "Supplier contact deleted successfully.");
  } catch (error) {
    console.error("Error deleting supplier contact:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSupplierContact = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { supplier_contact_id } = req.params;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    if (!supplier_contact_id) {
      return errorResponse(res, 400, "supplier_contact_id is required.");
    }

    const { contact_name, email, phone, contact_type } = req.body;

    const checkQuery = `
      SELECT sc.* 
      FROM supplier_contacts sc
      JOIN supplier s ON sc.supplier_id = s.supplier_id
      WHERE sc.supplier_contact_id = $1
        AND s.builder_id = $2
      LIMIT 1;
    `;

    const checkResult = await client.query(checkQuery, [
      supplier_contact_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or does not belong to this builder.",
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (contact_name !== undefined) {
      fields.push(`contact_name = $${i++}`);
      values.push(contact_name.trim());
    }

    if (email !== undefined) {
      fields.push(`email = $${i++}`);
      values.push(email.trim());
    }

    if (phone !== undefined) {
      fields.push(`phone = $${i++}`);
      values.push(phone.trim());
    }

    if (contact_type !== undefined) {
      fields.push(`contact_type = $${i++}`);
      values.push(contact_type.trim());
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE supplier_contacts
      SET ${fields.join(", ")}
      WHERE supplier_contact_id = $${i}
      RETURNING *;
    `;

    values.push(supplier_contact_id);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Supplier contact updated successfully.",
    );
  } catch (error) {
    console.error("Error updating supplier contact:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
