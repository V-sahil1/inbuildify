import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

export async function createNote(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { 
      leads_id, 
      description, 
      note_tag_id, 
      send_to_customer, 
      create_follow_up_task,
      task_name,
      due_date,
      note_type,
      parent_note_id
    } = req.body;

    const attach_file = req.file?.location || null;

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    let effectiveLeadsId = leads_id;
    await client.query("BEGIN");

    if (note_type === "reply") {
      const parentCheck = await client.query(
        `SELECT n.leads_id 
         FROM notes n
         JOIN leads l ON n.leads_id = l.leads_id
         WHERE n.notes_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)`,
        [parent_note_id, builderId, companyId]
      );

      if (parentCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        if (attach_file) await deleteFromS3(attach_file);
        return errorResponse(res, 404, "Parent note not found or access denied.");
      }

      effectiveLeadsId = parentCheck.rows[0].leads_id;

      const existingReply = await client.query(
        `SELECT notes_id FROM notes WHERE parent_note_id = $1`,
        [parent_note_id]
      );

      if (existingReply.rowCount > 0) {
        await client.query("ROLLBACK");
        if (attach_file) await deleteFromS3(attach_file);
        return errorResponse(res, 400, "A reply already exists for this note.");
      }
    }

    // Check leads_id existence and ownership
    const leadCheck = await client.query(
      `SELECT leads_id FROM leads 
       WHERE leads_id = $1 AND (builder_id = $2 OR company_id = $3)`,
      [effectiveLeadsId, builderId, companyId]
    );

    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      if (attach_file) await deleteFromS3(attach_file);
      return errorResponse(res, 403, "Invalid leads_id or access denied.");
    }

    // Check note_tag_id existence and ownership if provided
    if (note_tag_id && Array.isArray(note_tag_id) && note_tag_id.length > 0) {
      const tagCheck = await client.query(
        `SELECT notes_tag_id FROM notes_tag 
         WHERE notes_tag_id = ANY($1) AND (builder_id = $2 OR company_id = $3)`,
        [note_tag_id, builderId, companyId]
      );

      if (tagCheck.rowCount !== note_tag_id.length) {
        await client.query("ROLLBACK");
        if (attach_file) await deleteFromS3(attach_file);
        return errorResponse(res, 403, "One or more note_tag_id are invalid or access denied.");
      }
    }

    // Create follow-up task if requested
    let createdTaskId = null;
    if (create_follow_up_task === true || create_follow_up_task === "true") {
      const taskInsertQuery = `
        INSERT INTO task (
          company_id, builder_id, name, due_date, lead_id, 
          assignee_id, created_by, updated_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING task_id
      `;
      const taskResult = await client.query(taskInsertQuery, [
        companyId,
        builderId,
        task_name,
        due_date,
        effectiveLeadsId,
        req.user.users_id,
        req.user.users_id,
        req.user.users_id,
        "Yet to Start"
      ]);
      createdTaskId = taskResult.rows[0].task_id;
    }

    const insertQuery = `
      INSERT INTO notes (
        leads_id, 
        description, 
        note_tag_id, 
        send_to_customer, 
        create_follow_up_task, 
        task_id,
        attach_file,
        note_type,
        parent_note_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      effectiveLeadsId,
      description || null,
      note_tag_id || "{}",
      send_to_customer || false,
      create_follow_up_task || false,
      createdTaskId,
      attach_file,
      note_type,
      parent_note_id || null
    ]);

    const enrichedNoteQuery = `
      SELECT n.*,
        (SELECT json_agg(json_build_object('id', nt.notes_tag_id, 'name', nt.name)) 
         FROM notes_tag nt 
         WHERE nt.notes_tag_id = ANY(n.note_tag_id)) AS note_tags,
        (SELECT name FROM users WHERE users_id = l.created_by) AS createdbyname
      FROM notes n
      JOIN leads l ON n.leads_id = l.leads_id
      WHERE n.notes_id = $1
    `;
    const enrichedNoteResult = await client.query(enrichedNoteQuery, [result.rows[0].notes_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(enrichedNoteResult.rows[0]),
      "Note created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    if (req.file?.location) await deleteFromS3(req.file.location);
    console.error("Error creating note:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllNotes(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { leads_id, page = 1, limit = 25 } = req.query;

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const filters = [`l.builder_id = $1 OR l.company_id = $2`];
    const values = [builderId, companyId];
    let index = 3;

    if (leads_id) {
      filters.push(`n.leads_id = $${index}`);
      values.push(leads_id);
      index++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) FROM notes n
      JOIN leads l ON n.leads_id = l.leads_id
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].count, 10);

    const selectQuery = `
      SELECT n.*,
        (SELECT json_agg(json_build_object('id', nt.notes_tag_id, 'name', nt.name)) 
         FROM notes_tag nt 
         WHERE nt.notes_tag_id = ANY(n.note_tag_id)) AS note_tags,
        (SELECT name FROM users WHERE users_id = l.created_by) AS createdbyname
      FROM notes n
      JOIN leads l ON n.leads_id = l.leads_id
      ${whereClause} 
      ORDER BY n.created_at DESC 
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const dataResult = await client.query(selectQuery, [...values, limitValue, offset]);

    return successResponse(
      res,
      {
        notes: keysToCamelCase(dataResult.rows),
        pagination: {
          totalRecords,
          totalPages: Math.ceil(totalRecords / limitValue),
          currentPage: pageValue,
          limit: limitValue,
        },
      },
      "Notes fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching notes:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getNoteById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { notes_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const query = `
      SELECT n.*,
        (SELECT json_agg(json_build_object('id', nt.notes_tag_id, 'name', nt.name)) 
         FROM notes_tag nt 
         WHERE nt.notes_tag_id = ANY(n.note_tag_id)) AS note_tags,
        (SELECT name FROM users WHERE users_id = l.created_by) AS createdbyname
      FROM notes n
      JOIN leads l ON n.leads_id = l.leads_id
      WHERE n.notes_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)
    `;
    const result = await client.query(query, [notes_id, builderId, companyId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Note not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Note fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching note by ID:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateNote(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { notes_id } = req.params;
    const { description, note_tag_id, send_to_customer, create_follow_up_task } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const checkNote = await client.query(
      `SELECT n.attach_file, n.note_type FROM notes n
       JOIN leads l ON n.leads_id = l.leads_id
       WHERE n.notes_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)`,
      [notes_id, builderId, companyId]
    );

    if (checkNote.rowCount === 0) {
      await client.query("ROLLBACK");
      if (req.file?.location) await deleteFromS3(req.file.location);
      return errorResponse(res, 404, "Note not found or access denied.");
    }

    let parsedNoteTagId = null;
    if (note_tag_id) {
      parsedNoteTagId = typeof note_tag_id === 'string' ? JSON.parse(note_tag_id) : note_tag_id;
      if (Array.isArray(parsedNoteTagId) && parsedNoteTagId.length > 0) {
        const tagCheck = await client.query(
          `SELECT notes_tag_id FROM notes_tag 
           WHERE notes_tag_id = ANY($1) AND (builder_id = $2 OR company_id = $3)`,
          [parsedNoteTagId, builderId, companyId]
        );
        if (tagCheck.rowCount !== parsedNoteTagId.length) {
          await client.query("ROLLBACK");
          if (req.file?.location) await deleteFromS3(req.file.location);
          return errorResponse(res, 403, "One or more note_tag_id are invalid or access denied.");
        }
      }
    }

    const oldFile = checkNote.rows[0].attach_file;
    const noteType = checkNote.rows[0].note_type;
    const newFile = req.file?.location || null;

    const fields = [];
    const values = [];
    let index = 1;

    // Only allow tagging, customer sending, and follow-up task updates if NOT a reply
    if (noteType === "reply") {
      if (note_tag_id !== undefined || create_follow_up_task !== undefined) {
        await client.query("ROLLBACK");
        if (req.file?.location) await deleteFromS3(req.file.location);
        return errorResponse(res, 400, "note_tag_id and create_follow_up_task are not allowed for reply type");
      }
    }

    if (description !== undefined) {
      fields.push(`description = $${index}`);
      values.push(description);
      index++;
    }

    if (send_to_customer !== undefined) {
      fields.push(`send_to_customer = $${index}`);
      values.push(send_to_customer === 'true' || send_to_customer === true);
      index++;
    }

    if (noteType !== "reply") {
      if (note_tag_id !== undefined) {
        fields.push(`note_tag_id = $${index}`);
        values.push(parsedNoteTagId || "{}");
        index++;
      }
      if (create_follow_up_task !== undefined) {
        fields.push(`create_follow_up_task = $${index}`);
        values.push(create_follow_up_task === 'true' || create_follow_up_task === true);
        index++;
      }
    }
    if (newFile) {
      fields.push(`attach_file = $${index}`);
      values.push(newFile);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update.");
    }

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE notes 
      SET ${fields.join(", ")} 
      WHERE notes_id = $${index} 
      RETURNING *
    `;

    const result = await client.query(updateQuery, [...values, notes_id]);

    if (newFile && oldFile) {
      await deleteFromS3(oldFile);
    }

    const enrichedNoteQuery = `
      SELECT n.*,
        (SELECT json_agg(json_build_object('id', nt.notes_tag_id, 'name', nt.name)) 
         FROM notes_tag nt 
         WHERE nt.notes_tag_id = ANY(n.note_tag_id)) AS note_tags,
        (SELECT name FROM users WHERE users_id = l.created_by) AS createdbyname
      FROM notes n
      JOIN leads l ON n.leads_id = l.leads_id
      WHERE n.notes_id = $1
    `;
    const enrichedNoteResult = await client.query(enrichedNoteQuery, [notes_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(enrichedNoteResult.rows[0]),
      "Note updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    if (req.file?.location) await deleteFromS3(req.file.location);
    console.error("Error updating note:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteNote(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { notes_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const checkNote = await client.query(
      `SELECT n.attach_file FROM notes n
       JOIN leads l ON n.leads_id = l.leads_id
       WHERE n.notes_id = $1 AND (l.builder_id = $2 OR l.company_id = $3)`,
      [notes_id, builderId, companyId]
    );

    if (checkNote.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Note not found or access denied.");
    }

    const fileUrl = checkNote.rows[0].attach_file;

    const result = await client.query(
      "DELETE FROM notes WHERE notes_id = $1 RETURNING notes_id",
      [notes_id]
    );

    if (fileUrl) {
      await deleteFromS3(fileUrl);
    }

    await client.query("COMMIT");

    return successResponse(res, {}, "Note deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting note:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export default {
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
};
