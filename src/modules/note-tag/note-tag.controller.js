import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createNotesTag(req, res) {
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
      [name, companyId, builderId],
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
      "Notes Tag created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating notes tag:", err);
    return errorResponse(res, 500, err?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllNoteTag(req, res) {
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
      "Note tag fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching note tag:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteNoteTag(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, "Note tag ID is required.");
    }
    const existingNoteTag = await client.query(
      "SELECT notes_tag_id FROM notes_tag WHERE notes_tag_id = $1 AND builder_id = $2",
      [id, builderId],
    );

    if (existingNoteTag.rowCount === 0) {
      return errorResponse(res, 404, "Note tag not found for this builder.");
    }

    await client.query("DELETE FROM notes_tag WHERE notes_tag_id = $1", [id]);

    return successResponse(res, null, "Note tag deleted successfully.");
  } catch (error) {
    console.error("Error deleting note tag:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateNoteTag(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, background_color, font_color } = req.body;

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

    const existingActiveQuery = `
      SELECT * FROM notes_tag 
      WHERE notes_tag_id = $1 AND builder_id = $2  AND is_active = true FOR UPDATE
    `;
    const existingActiveNoteTag = await client.query(existingActiveQuery, [
      id,
      builder_id,
    ]);

    if (existingActiveNoteTag.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive note tag.");
    }

    if (name) {
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
          "Name already exists, please choose another name",
        );
      }
    }

    const updateQuery = `
      UPDATE notes_tag
      SET 
        name = COALESCE($1, name),
        background_color = COALESCE($2, background_color),
        font_color = COALESCE($3, font_color),
        updated_by = $4,
        updated_at = NOW()
      WHERE notes_tag_id = $5
      RETURNING *
    `;

    const values = [name, background_color, font_color, updated_by, id];

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Notes tag updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Notes Tag Error:", error);
    return errorResponse(res, "Internal server error", 500);
  } finally {
    client.release();
  }
}

export async function updateNoteTagIsActive(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { is_active } = req.body;

    if (!id) {
      return errorResponse(res, 400, "custom field id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)",
      );
    }

    const existing = await client.query(
      `
      SELECT notes_tag_id
      FROM notes_tag
      WHERE notes_tag_id = $1
        AND builder_id = $2
      `,
      [id, builderId],
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "note tag not found for this builder");
    }

    const updateQuery = `
      UPDATE notes_tag
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE notes_tag_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [is_active, userId, id]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "note tag status updated successfully.",
    );
  } catch (error) {
    console.error("Error updating note tag is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
