import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";
import { Op } from "sequelize";

/**
 * Helper to enrich note data with tags and creator name
 */
async function enrichNote(note, transaction = null) {
  const noteJson = note.get({ plain: true });
  const { NotesTag, Leads, Users } = db;

  // 1. Fetch tags
  let noteTags = [];
  if (noteJson.note_tag_id && noteJson.note_tag_id.length > 0) {
    const tags = await NotesTag.findAll({
      where: { notes_tag_id: { [Op.in]: noteJson.note_tag_id } },
      attributes: [["notes_tag_id", "id"], "name"],
      transaction,
    });
    noteTags = tags.map(t => t.get({ plain: true }));
  }

  // 2. Fetch createdbyname (from lead creator)
  const lead = await Leads.findOne({
    where: { leads_id: noteJson.leads_id },
    attributes: ["created_by"],
    include: [{ model: Users, as: "createdByUser", attributes: ["name"] }],
    transaction,
  });

  return {
    ...noteJson,
    note_tags: noteTags,
    createdbyname: lead?.createdByUser?.name || null,
    // Map task fields for parity
    task: noteJson.task ? {
      id: noteJson.task.task_id,
      taskname: noteJson.task.name,
      due_date: noteJson.task.due_date
    } : null
  };
}

/**
 * Create a new note
 */
export async function createNoteService(data, user, file) {
  const {
    leads_id,
    description,
    note_tag_id,
    send_to_customer,
    create_follow_up_task,
    task_name,
    due_date,
    note_type,
    parent_note_id,
  } = data;

  const attach_file = file?.location || null;
  const builderId = user?.builder_id;
  const companyId = user?.company_id;
  const userId = user?.users_id;

  const { Notes, Leads, NotesTag, Task, sequelize } = db;

  const transaction = await sequelize.transaction();
  try {
    let effectiveLeadsId = leads_id;

    if (note_type === "reply") {
      const parentNote = await Notes.findOne({
        where: { notes_id: parent_note_id },
        include: [{
          model: Leads,
          as: "lead",
          where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
          required: true
        }],
        transaction,
      });

      if (!parentNote) {
        throw { status: 404, message: "Parent note not found or access denied." };
      }

      effectiveLeadsId = parentNote.leads_id;

      const existingReply = await Notes.findOne({
        where: { parent_note_id },
        transaction,
      });

      if (existingReply) {
        throw { status: 400, message: "A reply already exists for this note." };
      }
    }

    // Lead ownership check
    const lead = await Leads.findOne({
      where: {
        leads_id: effectiveLeadsId,
        [Op.or]: [{ builder_id: builderId }, { company_id: companyId }]
      },
      transaction,
    });

    if (!lead) {
      throw { status: 403, message: "Invalid leads_id or access denied." };
    }

    // Tag ownership check
    let parsedTags = [];
    if (note_tag_id) {
      parsedTags = typeof note_tag_id === "string" ? JSON.parse(note_tag_id) : note_tag_id;
      if (Array.isArray(parsedTags) && parsedTags.length > 0) {
        const validTags = await NotesTag.findAll({
          where: {
            notes_tag_id: { [Op.in]: parsedTags },
            [Op.or]: [{ builder_id: builderId }, { company_id: companyId }]
          },
          transaction,
        });

        if (validTags.length !== parsedTags.length) {
          throw { status: 403, message: "One or more note_tag_id are invalid or access denied." };
        }
      }
    }

    // Create follow-up task
    let createdTaskId = null;
    if (create_follow_up_task === true || create_follow_up_task === "true") {
      const task = await Task.create({
        company_id: companyId,
        builder_id: builderId,
        name: task_name,
        due_date,
        lead_id: effectiveLeadsId,
        assignee_id: userId,
        created_by: userId,
        updated_by: userId,
        status: "Yet to Start",
      }, { transaction });
      createdTaskId = task.task_id;
    }

    const note = await Notes.create({
      leads_id: effectiveLeadsId,
      description: description || null,
      note_tag_id: parsedTags || [],
      send_to_customer: send_to_customer === "true" || send_to_customer === true,
      create_follow_up_task: create_follow_up_task === "true" || create_follow_up_task === true,
      task_id: createdTaskId,
      attach_file,
      note_type,
      parent_note_id: parent_note_id || null,
    }, { transaction });

    // Enriched response fetch
    const enriched = await Notes.findOne({
      where: { notes_id: note.notes_id },
      include: [{ model: Task, as: "task" }],
      transaction,
    });

    const finalNote = await enrichNote(enriched, transaction);

    await logActivity(transaction, {
      userId,
      leadsId: effectiveLeadsId,
      module: "Note",
      moduleId: note.notes_id,
      recordName: "Note",
      action: "CREATE",
      description: "Note created",
    });

    await transaction.commit();
    return finalNote;
  } catch (error) {
    if (transaction) await transaction.rollback();
    if (attach_file) await deleteFromS3(attach_file);
    throw error;
  }
}

/**
 * Get all notes
 */
export async function getAllNotesService(query, user) {
  const { leads_id, page = 1, limit = 25 } = query;
  const builderId = user?.builder_id;
  const companyId = user?.company_id;

  const { Notes, Leads, Task } = db;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows } = await Notes.findAndCountAll({
    include: [
      {
        model: Leads,
        as: "lead",
        where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        required: true,
      },
      { model: Task, as: "task" }
    ],
    where: leads_id ? { leads_id } : {},
    order: [["created_at", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  const enrichedNotes = await Promise.all(rows.map(note => enrichNote(note)));

  return {
    notes: enrichedNotes,
    totalRecords: count,
  };
}

/**
 * Get note by ID
 */
export async function getNoteByIdService(id, user) {
  const builderId = user?.builder_id;
  const companyId = user?.company_id;

  const { Notes, Leads, Task } = db;

  const note = await Notes.findOne({
    where: { notes_id: id },
    include: [
      {
        model: Leads,
        as: "lead",
        where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        required: true,
      },
      { model: Task, as: "task" }
    ],
  });

  if (!note) {
    throw { status: 404, message: "Note not found." };
  }

  return await enrichNote(note);
}

/**
 * Update note
 */
export async function updateNoteService(id, data, user, file) {
  const { description, note_tag_id, send_to_customer, create_follow_up_task } = data;
  const builderId = user?.builder_id;
  const companyId = user?.company_id;
  const userId = user?.users_id;

  const { Notes, Leads, NotesTag, Task, sequelize } = db;

  const transaction = await sequelize.transaction();
  try {
    const note = await Notes.findOne({
      where: { notes_id: id },
      include: [
        {
          model: Leads,
          as: "lead",
          where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
          required: true,
        },
        { model: Task, as: "task" }
      ],
      transaction,
    });

    if (!note) {
      throw { status: 404, message: "Note not found or access denied." };
    }

    const oldDataForLog = await enrichNote(note, transaction);

    // Tag validation
    let parsedTags = null;
    if (note_tag_id) {
      parsedTags = typeof note_tag_id === "string" ? JSON.parse(note_tag_id) : note_tag_id;
      if (Array.isArray(parsedTags) && parsedTags.length > 0) {
        const validTags = await NotesTag.findAll({
          where: {
            notes_tag_id: { [Op.in]: parsedTags },
            [Op.or]: [{ builder_id: builderId }, { company_id: companyId }]
          },
          transaction,
        });

        if (validTags.length !== parsedTags.length) {
          throw { status: 403, message: "One or more note_tag_id are invalid or access denied." };
        }
      }
    }

    const noteType = note.note_type;
    const oldFile = note.attach_file;
    const newFile = file?.location || null;

    if (noteType === "reply") {
      if (note_tag_id !== undefined || create_follow_up_task !== undefined) {
        throw { status: 400, message: "note_tag_id and create_follow_up_task are not allowed for reply type" };
      }
    }

    const updateData = {};
    if (description !== undefined) updateData.description = description;
    if (send_to_customer !== undefined) updateData.send_to_customer = send_to_customer === "true" || send_to_customer === true;
    if (newFile) updateData.attach_file = newFile;

    if (noteType !== "reply") {
      if (note_tag_id !== undefined) updateData.note_tag_id = parsedTags || [];
      if (create_follow_up_task !== undefined) updateData.create_follow_up_task = create_follow_up_task === "true" || create_follow_up_task === true;
    }

    await note.update(updateData, { transaction });

    if (newFile && oldFile) {
      await deleteFromS3(oldFile);
    }

    const updatedNote = await enrichNote(note, transaction);

    await compareAndLogUpdates(transaction, {
      userId,
      leadsId: note.leads_id,
      module: "Note",
      moduleId: id,
      recordName: "Note",
      oldData: keysToCamelCase(oldDataForLog),
      newData: keysToCamelCase(updatedNote),
    });

    await transaction.commit();
    return updatedNote;
  } catch (error) {
    if (transaction) await transaction.rollback();
    if (file?.location) await deleteFromS3(file.location);
    throw error;
  }
}

/**
 * Delete note
 */
export async function deleteNoteService(id, user) {
  const builderId = user?.builder_id;
  const companyId = user?.company_id;
  const userId = user?.users_id;

  const { Notes, Leads, sequelize } = db;

  const transaction = await sequelize.transaction();
  try {
    const note = await Notes.findOne({
      where: { notes_id: id },
      include: [{
        model: Leads,
        as: "lead",
        where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        required: true
      }],
      transaction,
    });

    if (!note) {
      throw { status: 404, message: "Note not found or access denied." };
    }

    const fileUrl = note.attach_file;
    const leadsId = note.leads_id;

    await note.destroy({ transaction });

    if (fileUrl) {
      await deleteFromS3(fileUrl);
    }

    await logActivity(transaction, {
      userId,
      leadsId,
      module: "Note",
      moduleId: id,
      recordName: "Note",
      action: "DELETE",
      description: "Note deleted",
    });

    await transaction.commit();
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

export default {
  createNoteService,
  getAllNotesService,
  getNoteByIdService,
  updateNoteService,
  deleteNoteService,
};
