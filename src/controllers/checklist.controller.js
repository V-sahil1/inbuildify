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
      `SELECT screen_id FROM screen WHERE screen_id = $1`,
      [screen_id]
    );
    if (screenRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Screen not found.");
    }

    const funcRes = await client.query(
      `SELECT functionality_id FROM functionality WHERE functionality_id = $1`,
      [functionality_id]
    );
    if (funcRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Functionality not found.");
    }

    const duplicateCheckQuery = `
      SELECT checklist_id
      FROM checklist
      WHERE functionality_id = $1
        AND name = $2
        AND (
          (builder_id = $3)
        )
      LIMIT 1;
    `;

    const duplicateResult = await client.query(duplicateCheckQuery, [
      functionality_id,
      name.trim(),
      builderId,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Functionality with this name already exists for this screen."
      );
    }

    const insertQuery = `
      WITH inserted AS (
        INSERT INTO checklist
          (builder_id, name, screen_id, functionality_id, is_active, created_by, updated_by)
        VALUES
          ($1, $2, $3, $4, COALESCE($5, TRUE), $6, $6)
        RETURNING checklist_id, name, screen_id, functionality_id, is_active
      )
      SELECT
        i.checklist_id,
        i.name,
        i.is_active,
        json_build_object(
          'id', s.screen_id,
          'name', s.name
        ) AS screen,
        json_build_object(
          'id', f.functionality_id,
          'name', f.name
        ) AS functionality
      FROM inserted i
      JOIN screen s ON s.screen_id = i.screen_id
      JOIN functionality f ON f.functionality_id = i.functionality_id;
    `;

    const insertRes = await client.query(insertQuery, [
      builderId,
      name,
      screen_id,
      functionality_id,
      is_active,
      createdBy,
    ]);

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
        c.checklist_id,
        c.name,
        c.is_active,
        json_build_object(
          'id', s.screen_id,
          'name', s.name
        ) AS screen,
        json_build_object(
          'id', f.functionality_id,
          'name', f.name
        ) AS functionality
      FROM checklist c
      LEFT JOIN screen s ON s.screen_id = c.screen_id
      LEFT JOIN functionality f ON f.functionality_id = c.functionality_id
      WHERE c.builder_id = $1
        AND c.is_deleted = false
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
      WHERE builder_id = $1
        AND is_deleted = false;
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
      "Checklist fetched successfully."
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
    const { name, functionality_id, screen_id } = req.body;
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

    const checklistCheck = await client.query(
      `
  SELECT checklist_id
  FROM checklist
  WHERE checklist_id = $1
    AND builder_id = $2
    AND is_active = TRUE
    AND is_deleted = FALSE
  `,
      [checklist_id, builderId]
    );

    if (checklistCheck.rowCount === 0) {
      return errorResponse(res, 400, "Checklist is inactive.");
    }

    if (screen_id) {
      const screenCheck = await client.query(
        `SELECT screen_id FROM screen WHERE screen_id = $1;`,
        [screen_id]
      );
      if (screenCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid screenId or screen not found.");
      }
    }

    if (functionality_id) {
      const funcCheck = await client.query(
        `SELECT functionality_id FROM functionality WHERE functionality_id = $1;`,
        [functionality_id]
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

    const finalName = name;

    if (name || functionality_id) {
      const duplicateCheckQuery = `
        SELECT checklist_id
        FROM checklist
        WHERE functionality_id = $1
          AND name = $2
          AND checklist_id <> $3
          AND builder_id = $4
        LIMIT 1;
      `;

      const duplicateResult = await client.query(duplicateCheckQuery, [
        functionality_id,
        finalName,
        checklist_id,
        builderId,
      ]);

      if (duplicateResult.rowCount > 0) {
        return errorResponse(
          res,
          409,
          "checklist with this name already exists for this functionality."
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
      RETURNING checklist_id, name, screen_id, functionality_id, updated_at;
    `;

    const finalValues = [checklist_id, builderId, ...values];

    await client.query(updateQuery, finalValues);

    const fetchQuery = `
      SELECT
        c.checklist_id,
        c.name,
        c.is_active,
        json_build_object(
          'id', s.screen_id,
          'name', s.name
        ) AS screen,
        json_build_object(
          'id', f.functionality_id,
          'name', f.name
        ) AS functionality
      FROM checklist c
      LEFT JOIN screen s ON s.screen_id = c.screen_id
      LEFT JOIN functionality f ON f.functionality_id = c.functionality_id
      WHERE c.checklist_id = $1
        AND c.builder_id = $2;
    `;

    const finalResult = await client.query(fetchQuery, [
      checklist_id,
      builderId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(finalResult.rows[0]),
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

exports.updateChecklistIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { checklist_id } = req.params;
    const { is_active } = req.body;

    if (!checklist_id) {
      return errorResponse(res, 400, "checklist_id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)"
      );
    }

    const existing = await client.query(
      `
      SELECT checklist_id
      FROM checklist
      WHERE checklist_id = $1
        AND builder_id = $2
        AND is_deleted = FALSE
      `,
      [checklist_id, builderId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Checklist not found for this builder");
    }

    const updateQuery = `
      UPDATE checklist
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE checklist_id = $3
      RETURNING checklist_id, is_active;
    `;

    const updated = await client.query(updateQuery, [
      is_active,
      userId,
      checklist_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Checklist status updated successfully."
    );
  } catch (error) {
    console.error("Error updating checklist is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
