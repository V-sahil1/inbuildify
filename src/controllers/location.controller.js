const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createLocation = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { name, status } = req.body;

    await client.query("BEGIN");

    const dupCheck = await client.query(
      `SELECT location_id 
       FROM location 
       WHERE builder_id = $1 AND LOWER(name) = LOWER($2)`,
      [builderId, name],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Location name already exists for this builder.",
      );
    }

    const insertQuery = `
      INSERT INTO location (
        company_id,
        builder_id,
        name,
        status,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [companyId, builderId, name, status ?? true, userId, userId];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Location created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating location:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllLocation = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const dataQuery = `
      SELECT *
      FROM location
      WHERE builder_id = $1 AND company_id = $2
      ORDER BY created_at DESC
    `;
    const dataResult = await client.query(dataQuery, [builderId, companyId]);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
      "Locations retrieved successfully.",
    );
  } catch (err) {
    console.error("Error fetching locations:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteLocation = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { location_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    if (!location_id) {
      return errorResponse(res, 400, "location_id is required.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT location_id 
      FROM location 
      WHERE location_id = $1 AND builder_id = $2
    `;
    const check = await client.query(checkQuery, [location_id, builderId]);

    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Location not found for this builder.");
    }

    const deleteQuery = `
      DELETE FROM location 
      WHERE location_id = $1
      RETURNING location_id;
    `;
    await client.query(deleteQuery, [location_id]);

    await client.query("COMMIT");

    return successResponse(res, null, "Location deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting location:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateLocation = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { location_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const { name, status } = req.body;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT *
      FROM location
      WHERE location_id = $1 AND builder_id = $2
      FOR UPDATE;
    `;
    const existingRes = await client.query(checkQuery, [
      location_id,
      builderId,
    ]);

    if (existingRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Location not found for this builder.");
    }

    const existing = existingRes.rows[0];

    const currentStatus = existing.status;
    const statusInBody = status !== undefined;
    const requestedStatus = status;

    const fieldsToCheck = ["name"];
    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'status' field must be a boolean (true or false).",
      );
    }

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active location, 'status' must be the only field provided in the request.",
        );
      }
    }

    if (currentStatus === false) {
      if (statusInBody && requestedStatus === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive location, 'status' must be the only field provided in the request.",
          );
        }
      }

      const performingActivation = statusInBody && requestedStatus === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'status' fields when the location is currently Inactive. Only 'status' can be changed (to true/Active).",
        );
      }

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Location is already Inactive. 'status' can only be updated to true (Active) from this state.",
        );
      }
    }

    if (name) {
      const dupCheck = await client.query(
        `SELECT location_id 
          FROM location
          WHERE builder_id = $1 AND LOWER(name) = LOWER($2) AND location_id != $3`,
        [builderId, name, location_id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          "Location name already exists for this builder.",
        );
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(name);
    }

    if (status !== undefined) {
      fields.push(`status = $${index++}`);
      values.push(status);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${index++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE location
      SET ${fields.join(", ")}
      WHERE location_id = $${index}
      RETURNING *;
    `;

    values.push(location_id);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Location updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating location:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
