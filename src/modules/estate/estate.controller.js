const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const { deleteFromS3 } = require("../../utils/s3Upload");

exports.createEstate = async (req, res) => {
  const {
    name,
    street_name,
    city,
    state_id,
    country_id,
    zip,
    website,
    description,
    status,
    featured,
  } = req.body || {};

  const estate_logo = req.body.estate_logo;

  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dupCheck = await client.query(
      `SELECT estate_id
       FROM estate
       WHERE builder_id = $1 AND LOWER(name) = LOWER($2)`,
      [builderId, name],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Estate name already exists.");
    }

    if (state_id) {
      const stateCheck = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1`,
        [state_id],
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id.");
      }
    }

    if (country_id) {
      const countryCheck = await client.query(
        `SELECT country_id FROM country WHERE country_id = $1`,
        [country_id],
      );

      if (countryCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid country_id.");
      }
    }

    const insertQuery = `
      INSERT INTO estate (
        company_id, builder_id, name,
        street_name, city, state_id, country_id, zip,
        estate_logo, website, description,
        status, featured, created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14, $14
      )
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name,
      street_name || null,
      city || null,
      state_id || null,
      country_id || null,
      zip || null,
      estate_logo,
      website || null,
      description || null,
      status || true,
      featured || false,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Estate created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create estate error:", error);
    return errorResponse(res, 500, "Failed to create estate.");
  } finally {
    client.release();
  }
};

exports.getAllEstate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const { page = 1, limit = 25, name, status, location } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = `WHERE e.builder_id = $1 AND e.company_id = $2`;
    const values = [builderId, companyId];
    let paramIndex = 3;

    if (name) {
      whereClause += ` AND LOWER(e.name) LIKE LOWER($${paramIndex})`;
      values.push(`%${name}%`);
      paramIndex++;
    }

    if (status !== undefined) {
      whereClause += ` AND e.status = $${paramIndex}`;
      values.push(status === "true");
      paramIndex++;
    }

    if (location) {
      whereClause += ` AND (
        LOWER(s.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(c.name) LIKE LOWER($${paramIndex})
      )`;
      values.push(`%${location}%`);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM estate e
      LEFT JOIN state s ON e.state_id = s.state_id
      LEFT JOIN country c ON e.country_id = c.country_id
      ${whereClause};
    `;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    const query = `
      SELECT 
        e.*,
        s.name as state_name,
        c.name as country_name
      FROM estate e
      LEFT JOIN state s ON e.state_id = s.state_id
      LEFT JOIN country c ON e.country_id = c.country_id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset};
    `;

    const result = await client.query(query, values);

    return successResponse(res, {
      estate: keysToCamelCase(result.rows),
      records: total,
      currentPage: pageNum,
      limit: limitNum,
      totalPage: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Get all estates error:", error);
    return errorResponse(res, 500, "Failed to fetch estates.");
  } finally {
    client.release();
  }
};

exports.deleteEstate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { estate_id } = req.params;

    if (!estate_id) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "estate_id is required.");
    }

    const check = await client.query(
      `
      SELECT estate_id
      FROM estate
      WHERE estate_id = $1 
        AND builder_id = $2
        AND company_id = $3
      `,
      [estate_id, builderId, companyId],
    );

    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Estate not found or does not belong to this builder.",
      );
    }

    await client.query(
      `
      DELETE FROM estate
      WHERE estate_id = $1
      `,
      [estate_id],
    );

    await client.query("COMMIT");

    return successResponse(res, {}, "Estate deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete estate error:", error);
    return errorResponse(res, 500, "Failed to delete estate.");
  } finally {
    client.release();
  }
};

exports.updateEstate = async (req, res) => {
  const { estate_id } = req.params;

  let body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    try {
      body = JSON.parse(req.body);
    } catch {
      body = {};
    }
  }

  const {
    name,
    street_name,
    city,
    state_id,
    country_id,
    zip,
    website,
    description,
    featured,
    status,
  } = body;

  const estate_logo = body.estate_logo;

  const builderId = req.user?.builder_id;
  const userId = req.user?.user_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM estate 
       WHERE estate_id = $1 AND builder_id = $2 
       FOR UPDATE`,
      [estate_id, builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate not found.");
    }

    const oldData = existing.rows[0];

    const statusInBody = Object.prototype.hasOwnProperty.call(body, "status");

    let requestedStatus = status;

    if (statusInBody) {
      if (requestedStatus === "true") requestedStatus = true;
      if (requestedStatus === "false") requestedStatus = false;

      if (typeof requestedStatus !== "boolean") {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "The 'status' field must be a boolean (true or false).",
        );
      }
    }

    const fieldsToCheck = [
      "name",
      "street_name",
      "city",
      "state_id",
      "country_id",
      "zip",
      "website",
      "description",
      "featured",
      "estate_logo",
    ];

    const updatingOtherFields = fieldsToCheck.some((f) =>
      Object.prototype.hasOwnProperty.call(body, f),
    );

    const currentStatus = oldData.status;

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active estate, only 'status' must be provided.",
        );
      }
    }

    if (currentStatus === false) {
      const performingActivation = statusInBody && requestedStatus === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'status' fields while estate is Inactive. Only 'status' may be set to true.",
        );
      }

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Estate is already Inactive. You can only activate it.",
        );
      }
    }

    if (name) {
      const dupCheck = await client.query(
        `SELECT estate_id FROM estate
         WHERE builder_id = $1 AND LOWER(name) = LOWER($2)
         AND estate_id != $3`,
        [builderId, name, estate_id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 409, "Estate name already exists.");
      }
    }

    if (state_id) {
      const sCheck = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1`,
        [state_id],
      );
      if (sCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id.");
      }
    }

    if (country_id) {
      const cCheck = await client.query(
        `SELECT country_id FROM country WHERE country_id = $1`,
        [country_id],
      );
      if (cCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid country_id.");
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "estate_logo") &&
      estate_logo &&
      oldData.estate_logo
    ) {
      await deleteFromS3(oldData.estate_logo);
    }

    let updateFields = [];
    let updateValues = [];
    let idx = 1;

    const push = (column, value, isString = false) => {
      if (!Object.prototype.hasOwnProperty.call(body, column)) return;

      let finalValue = value;
      if (isString && typeof finalValue === "string") {
        finalValue = finalValue.trim();
      }

      updateFields.push(`${column} = $${idx}`);
      updateValues.push(finalValue);
      idx++;
    };

    push("name", name, true);
    push("street_name", street_name, true);
    push("city", city, true);
    push("state_id", state_id);
    push("country_id", country_id);
    push("zip", zip, true);
    push("website", website, true);
    push("description", description, true);
    push("featured", featured);
    if (statusInBody) push("status", requestedStatus);
    if (Object.prototype.hasOwnProperty.call(body, "estate_logo"))
      push("estate_logo", estate_logo);

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    updateFields.push(`updated_by = $${idx}`);
    updateValues.push(userId);
    idx++;

    updateFields.push("updated_at = NOW()");

    updateValues.push(estate_id);

    const updateQuery = `
      UPDATE estate
      SET ${updateFields.join(", ")}
      WHERE estate_id = $${idx}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Estate updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update estate error:", err);
    return errorResponse(res, 500, "Failed to update estate.");
  } finally {
    client.release();
  }
};
