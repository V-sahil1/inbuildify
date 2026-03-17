import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createSurveyor(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    await client.query("BEGIN");

    const {
      name,
      email,
      phone,
      abn_number,
      registration_number,
      address1,
      address2,
      city,
      state_id,
      zip_postal_code,
    } = req.body;

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    if (!name || !address1 || !city || !zip_postal_code) {
      return errorResponse(
        res,
        400,
        "Name, address1, city, and zip/postal code are required.",
      );
    }

    if (email) {
      const duplicateQuery = `
        SELECT surveyor_id
        FROM surveyor
        WHERE builder_id = $1
          AND LOWER(email) = LOWER($2);
      `;

      const duplicateCheck = await client.query(duplicateQuery, [
        builderId,
        email,
      ]);

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Surveyor with this email already exists.",
        );
      }
    }

    if (state_id) {
      const stateCheck = await client.query(
        "SELECT state_id FROM state WHERE state_id = $1;",
        [state_id],
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state id.");
      }
    }

    const insertQuery = `
      INSERT INTO surveyor (
        company_id,
        builder_id,
        name,
        email,
        phone,
        abn_number,
        registration_number,
        address1,
        address2,
        city,
        state_id,
        zip_postal_code
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12
      )
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name,
      email || null,
      phone || null,
      abn_number || null,
      registration_number || null,
      address1,
      address2 || null,
      city,
      state_id,
      zip_postal_code,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Surveyor created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating surveyor:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllSurveyor(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
       *
      FROM surveyor s
      WHERE s.builder_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM surveyor
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        surveyors: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Surveyors fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching surveyors:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteSurveyor(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { surveyor_id } = req.params;
    const builderId = req.user.builder_id;

    if (!surveyor_id) {
      return errorResponse(res, 400, "Surveyor ID is required.");
    }
    const existingSurveyor = await client.query(
      "SELECT surveyor_id FROM surveyor WHERE surveyor_id = $1 AND builder_id = $2",
      [surveyor_id, builderId],
    );

    if (existingSurveyor.rowCount === 0) {
      return errorResponse(res, 404, "Surveyor not found for this builder.");
    }

    await client.query("DELETE FROM surveyor WHERE surveyor_id = $1", [
      surveyor_id,
    ]);

    return successResponse(res, null, "Surveyor deleted successfully.");
  } catch (error) {
    console.error("Error deleting surveyor:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateSurveyor(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { surveyor_id } = req.params;
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!surveyor_id) {
      return errorResponse(res, 400, "Surveyor ID is required.");
    }

    const {
      name,
      email,
      phone,
      abn_number,
      registration_number,
      address1,
      address2,
      city,
      state_id,
      zip_postal_code,
    } = req.body;

    if (
      !name &&
      !email &&
      !phone &&
      !abn_number &&
      !registration_number &&
      !address1 &&
      !address2 &&
      !city &&
      !state_id &&
      !zip_postal_code
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update.",
      );
    }

    await client.query("BEGIN");

    const existingSurveyor = await client.query(
      `SELECT surveyor_id 
       FROM surveyor 
       WHERE surveyor_id = $1 
         AND builder_id = $2`,
      [surveyor_id, builderId],
    );

    if (existingSurveyor.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Surveyor not found for this builder.");
    }

    if (email) {
      const duplicateEmail = await client.query(
        `SELECT surveyor_id
         FROM surveyor
         WHERE LOWER(email) = LOWER($1)
           AND builder_id = $2
           AND surveyor_id != $3`,
        [email, builderId, surveyor_id],
      );

      if (duplicateEmail.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Email already exists for another surveyor.",
        );
      }
    }

    if (state_id) {
      const stateCheck = await client.query(
        "SELECT state_id FROM state WHERE state_id = $1;",
        [state_id],
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state id.");
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (email) {
      fields.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (abn_number) {
      fields.push(`abn_number = $${paramIndex++}`);
      values.push(abn_number);
    }
    if (registration_number) {
      fields.push(`registration_number = $${paramIndex++}`);
      values.push(registration_number);
    }
    if (address1) {
      fields.push(`address1 = $${paramIndex++}`);
      values.push(address1);
    }
    if (address2) {
      fields.push(`address2 = $${paramIndex++}`);
      values.push(address2);
    }
    if (city) {
      fields.push(`city = $${paramIndex++}`);
      values.push(city);
    }
    if (state_id) {
      fields.push(`state_id = $${paramIndex++}`);
      values.push(state_id);
    }
    if (zip_postal_code) {
      fields.push(`zip_postal_code = $${paramIndex++}`);
      values.push(zip_postal_code);
    }

    fields.push(`company_id = $${paramIndex++}`);
    values.push(companyId);

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE surveyor
      SET ${fields.join(", ")}
      WHERE surveyor_id = $${paramIndex}
        AND builder_id = $${paramIndex + 1}
      RETURNING *;
    `;

    values.push(surveyor_id, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Surveyor updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating surveyor:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
