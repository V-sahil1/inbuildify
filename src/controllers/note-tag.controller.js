const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createNotesTag = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;
    const companyId = req.user?.company_id;
    const { name, background_color, font_color, is_active } = req.body;

    await client.query("BEGIN");

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1 FROM notes_tag 
      WHERE LOWER(name) = LOWER($1)
      AND company_id = $2 
      AND builder_id = $3
    `,
      [name, companyId, builderId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Tag name already exists.");
    }

    const insertQuery = `
      INSERT INTO notes_tag 
        (company_id, builder_id, name, background_color, font_color,is_active, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      background_color || null,
      font_color || null,
      is_active || true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Notes Tag created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating notes tag:", err);
    return errorResponse(res, 500, err?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllNoteTag = async (req, res) => {
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
      FROM notes_tag nt
      WHERE nt.builder_id = $1
      ORDER BY nt.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    //  Count total records (for pagination)
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM notes_tag
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        noteTag: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Note tag fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching note tag:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteNoteTag = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, "Note tag ID is required.");
    }
    const existingNoteTag = await client.query(
      `SELECT notes_tag_id FROM notes_tag WHERE notes_tag_id = $1 AND builder_id = $2`,
      [id, builderId]
    );

    if (existingNoteTag.rowCount === 0) {
      return errorResponse(res, 404, "Note tag not found for this builder.");
    }

    await client.query(`DELETE FROM notes_tag WHERE notes_tag_id = $1`, [id]);

    return successResponse(res, null, "Note tag deleted successfully.");
  } catch (error) {
    console.error("Error deleting note tag:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateNoteTag = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, background_color, font_color, is_active } = req.body;

    const companyId = req.user?.company_id;
    const builder_id = req.user?.builder_id;
    const updated_by = req.user?.user_id;

    if (!builder_id) {
      return errorResponse(res, "Unauthorized access", 401);
    }

    await client.query("BEGIN");

    // Retrieve existing record and lock the row (FOR UPDATE)
    const existingQuery = `
      SELECT * FROM notes_tag 
      WHERE notes_tag_id = $1 AND builder_id = $2 FOR UPDATE
    `;
    const existingNoteTag = await client.query(existingQuery, [id, builder_id]);

    if (existingNoteTag.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Note tag not found for this builder.");
    }

    const existing = existingNoteTag.rows[0];

    // --- Start Is Active Business Logic ---

    const currentIsActive = existing.is_active; // Current status from DB
    const isActiveInBody = is_active !== undefined;
    const requestedIsActive = is_active;

    // Define fields that are considered 'other fields' besides 'is_active'
    const fieldsToCheck = ["name", "background_color", "font_color"];
    // Check if any field other than 'is_active' is present in the request body
    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    // Check for boolean type validation if is_active is present
    if (isActiveInBody && typeof requestedIsActive !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'is_active' field must be a boolean (true or false)."
      );
    }

    // 1. Active (true) to Inactive (false) transition
    if (
      currentIsActive === true &&
      isActiveInBody &&
      requestedIsActive === false
    ) {
      // RULE: If deactivating (true -> false), only 'is_active' must be present.
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active note tag, 'is_active' must be the only field provided in the request."
        );
      }
    }

    // 2. Inactive Status Rules (currentIsActive = false)
    if (currentIsActive === false) {
      // RULE: If activating (false -> true), only 'is_active' must be present.
      if (isActiveInBody && requestedIsActive === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive note tag, 'is_active' must be the only field provided in the request."
          );
        }
      }

      // RULE: Block updates to non-'is_active' fields entirely.
      const performingActivation = isActiveInBody && requestedIsActive === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the note tag is currently Inactive. Only 'is_active' can be changed (to true/Active)."
        );
      }

      // RULE: Block Inactive -> Inactive update.
      if (isActiveInBody && requestedIsActive === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Note tag is already Inactive. 'is_active' can only be updated to true (Active) from this state."
        );
      }
    }
    // --- End Is Active Business Logic ---

    if (name) {
      // Note: Changed to use client.query for better transactional context
      const duplicateQuery = `
        SELECT * FROM notes_tag 
        WHERE name = $1 
          AND (company_id = $2 OR builder_id = $3)
          AND notes_tag_id <> $4
      `;
      const duplicateResult = await client.query(duplicateQuery, [
        name,
        companyId,
        builder_id,
        id,
      ]);

      if (duplicateResult.rows.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Name already exists, please choose another name"
        );
      }
    }

    const updateQuery = `
      UPDATE notes_tag
      SET 
        name = COALESCE($1, name),
        background_color = COALESCE($2, background_color),
        font_color = COALESCE($3, font_color),
        is_active = COALESCE($4, is_active),
        updated_by = $5,
        updated_at = NOW()
      WHERE notes_tag_id = $6
      RETURNING *
    `;

    const values = [
      name,
      background_color,
      font_color,
      is_active,
      updated_by,
      id,
    ];

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Notes tag updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Notes Tag Error:", error);
    return errorResponse(res, "Internal server error", 500);
  } finally {
    client.release();
  }
};
