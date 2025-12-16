const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const createdBy = req.user?.user_id;
    const builderId = req.user?.builder_id;
    const { name, screen_id, functionality_id, is_active } = req.body;

    await client.query("BEGIN");

    const screenRes = await client.query(
      `SELECT screen_id FROM screen WHERE screen_id = $1 AND builder_id = $2`,
      [screen_id, builderId]
    );
    if (screenRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Screen not found.");
    }

    const funcRes = await client.query(
      `SELECT functionality_id FROM functionality WHERE functionality_id = $1 AND builder_id = $2`,
      [functionality_id, builderId]
    );
    if (funcRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Functionality not found.");
    }

    const insertRes = await client.query(
      `INSERT INTO checklist
       (builder_id, name, screen_id, functionality_id, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, $6)
       RETURNING *`,
      [builderId, name, screen_id, functionality_id, is_active, createdBy]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertRes.rows[0]),
      "Checklist created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Checklist create error:", err);
    return errorResponse(res, 500, "Failed to create checklist");
  } finally {
    client.release();
  }
};

exports.getAllChecklist = async (req, res) => {
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
      FROM checklist c
      WHERE c.builder_id = $1 AND c.is_deleted = false
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM checklist
      WHERE builder_id = $1 AND is_deleted = false;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        checklist: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "checklist fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching checklist:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { checklist_id } = req.params;
    const { user_id } = req.user;

    if (!builderId) {
      return errorResponse(res, 403, "Unauthorized. Builder login required.");
    }

    if (!checklist_id) {
      return errorResponse(res, 400, "Checklist ID is required.");
    }

    const checkQuery = `
      SELECT checklist_id
      FROM checklist 
      WHERE checklist_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkResult = await client.query(checkQuery, [
      checklist_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Checklist not found or access denied.");
    }

    if (checkResult.rows[0].is_deleted) {
      return errorResponse(res, 400, "Checklist is already deleted.");
    }

    const deleteQuery = `
      UPDATE checklist
      SET 
        is_deleted = true,
        updated_at = NOW(),
        updated_by = $2
      WHERE checklist_id = $1 AND builder_id = $3
      RETURNING checklist_id, name, is_deleted, updated_at;
    `;
    const result = await client.query(deleteQuery, [
      checklist_id,
      user_id,
      builderId,
    ]);

    return successResponse(res, {}, "Checklist deleted successfully.");
  } catch (err) {
    console.error("Error soft deleting checklist:", err);
    return errorResponse(
      res,
      500,
      err.message || "Failed to delete checklist."
    );
  } finally {
    client.release();
  }
};

exports.updateChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { checklist_id } = req.params;
    const { name, is_active, functionality_id, screen_id } = req.body;
    const { user_id } = req.user;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT * FROM checklist
      WHERE checklist_id = $1 AND builder_id = $2 AND is_deleted = false FOR UPDATE;
    `;
    const checkResult = await client.query(checkQuery, [
      checklist_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Checklist not found or access denied.");
    }

    const existing = checkResult.rows[0];

    const currentIsActive = existing.is_active;
    const isActiveInBody = is_active !== undefined;
    const requestedIsActive = is_active;

    const fieldsToCheck = ["name", "functionality_id", "screen_id"];
    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    if (isActiveInBody && typeof requestedIsActive !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'is_active' field must be a boolean (true or false)."
      );
    }

    if (
      currentIsActive === true &&
      isActiveInBody &&
      requestedIsActive === false
    ) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active checklist, 'is_active' must be the only field provided in the request."
        );
      }
    }

    if (currentIsActive === false) {
      if (isActiveInBody && requestedIsActive === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive checklist, 'is_active' must be the only field provided in the request."
          );
        }
      }

      const performingActivation = isActiveInBody && requestedIsActive === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the checklist is currently Inactive. Only 'is_active' can be changed (to true/Active)."
        );
      }

      if (isActiveInBody && requestedIsActive === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Checklist is already Inactive. 'is_active' can only be updated to true (Active) from this state."
        );
      }
    }

    if (screen_id) {
      const screenCheck = await client.query(
        `SELECT screen_id FROM screen WHERE screen_id = $1 AND builder_id = $2;`,
        [screen_id, builderId]
      );
      if (screenCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid screenId or screen not found.");
      }
    }

    if (functionality_id) {
      const funcCheck = await client.query(
        `SELECT functionality_id FROM functionality WHERE functionality_id = $1 AND builder_id = $2;`,
        [functionality_id, builderId]
      );
      if (funcCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid functionalityId or functionality not found."
        );
      }
    }

    const fields = [];
    const values = [];
    let index = 3;

    if (name !== undefined) {
      fields.push(`name = $${index}`);
      values.push(name);
      index++;
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${index}`);
      values.push(is_active);
      index++;
    }
    if (functionality_id !== undefined) {
      fields.push(`functionality_id = $${index}`);
      values.push(functionality_id);
      index++;
    }
    if (screen_id !== undefined) {
      fields.push(`screen_id = $${index}`);
      values.push(screen_id);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${index}`);
    values.push(user_id);
    index++;

    const updateQuery = `
      UPDATE checklist
      SET ${fields.join(", ")}
      WHERE checklist_id = $1 AND builder_id = $2
      RETURNING checklist_id, name, is_active, screen_id, functionality_id, updated_at;
    `;

    const finalValues = [checklist_id, builderId, ...values];

    const result = await client.query(updateQuery, finalValues);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Checklist updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating checklist:", err);
    return errorResponse(
      res,
      500,
      err.message || "Failed to update checklist."
    );
  } finally {
    client.release();
  }
};
