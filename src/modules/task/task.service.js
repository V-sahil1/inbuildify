import { Op } from "sequelize";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import db from "../../config/database/models/postgre-models/index.js";

// ─── Shared Helpers ───────────────────────────────────────────────────────────

/** Validates a YYYY-MM-DD date string. Returns false if invalid. */
function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}

/**
 * Canonical field order for the task response shape.
 * Applied in both create and update to produce a consistently ordered object.
 */
const TASK_FIELD_ORDER = [
  "taskId", "companyId", "builderId", "name", "description",
  "dueDate", "dueTime", "assigneeId", "assigneeName",
  "linkTo", "linkType", "leadId", "priority", "status", "isDeleted",
  "attachFiles", "createdBy", "createdbyname", "updatedBy", "createdAt", "updatedAt",
];

/**
 * Reorders a camelCase task object into the canonical API field order.
 */
export function orderTaskFields(obj) {
  const ordered = {};
  TASK_FIELD_ORDER.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(obj, field)) {
      ordered[field] = obj[field];
    }
  });
  return ordered;
}

// ─── SERVICE: CREATE TASK ─────────────────────────────────────────────────────

/**
 * Creates a new Task.
 * Validates assignee_id, link_to user, lead_id ownership, and due_date format.
 *
 * @returns {{ data: object }|{ error: { status: number, message: string } }}
 */
export async function createTaskService({
  builderId,
  companyId,
  createdBy,
  name,
  description,
  due_date,
  due_time,
  assignee_id,
  link_to,
  link_type,
  lead_id,
  priority = "Medium",
  status = "Yet to Start",
  attach_files,
}) {
  const { Task, Users, Leads, sequelize } = db;
  const transaction = await sequelize.transaction();

  try {
    // ── Validate assignee_id ───────────────────────────────────────────────
    if (assignee_id) {
      const assignee = await Users.findOne({
        where: { users_id: assignee_id, is_deleted: false, is_verified: true },
        attributes: ["users_id"],
        transaction,
      });
      if (!assignee) {
        await transaction.rollback();
        return { error: { status: 400, message: "Invalid assignee_id" } };
      }
    }

    // ── Validate link_to user ──────────────────────────────────────────────
    if (link_to) {
      const linkedUser = await Users.findOne({
        where: { users_id: link_to, is_deleted: false, is_verified: true },
        attributes: ["users_id"],
        transaction,
      });
      if (!linkedUser) {
        await transaction.rollback();
        return { error: { status: 400, message: "Invalid link_to user_id" } };
      }
    }

    // ── Validate lead_id ownership ─────────────────────────────────────────
    if (lead_id) {
      const lead = await Leads.findOne({
        where: {
          leads_id: lead_id,
          [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
        },
        attributes: ["leads_id"],
        transaction,
      });
      if (!lead) {
        await transaction.rollback();
        return {
          error: {
            status: 400,
            message: "Invalid lead_id. Lead not found for this builder/company.",
          },
        };
      }
    }

    // ── Validate due_date ──────────────────────────────────────────────────
    if (due_date && !isValidDate(due_date)) {
      await transaction.rollback();
      return { error: { status: 400, message: `Invalid date: ${due_date}` } };
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    const created = await Task.create(
      {
        company_id: companyId,
        builder_id: builderId,
        name,
        description: description || null,
        due_date: due_date || null,
        due_time: due_time || null,
        assignee_id: assignee_id || null,
        link_to: link_to || null,
        link_type: link_type || null,
        lead_id: lead_id || null,
        priority,
        status,
        attach_files,
        created_by: createdBy,
        updated_by: createdBy,
      },
      { transaction },
    );

    await transaction.commit();

    // ── Enrich: fetch assignee name and createdbyname ──────────────────────
    const enriched = await Task.findOne({
      where: { task_id: created.task_id },
      include: [
        { model: Users, as: "assignee", attributes: ["name"] },
        { model: Users, as: "createdByUser", attributes: ["name"] },
      ],
    });

    const transformed = keysToCamelCase(enriched.get({ plain: true }));
    transformed.assigneeName = enriched.assignee?.name ?? null;
    transformed.createdbyname = enriched.createdByUser?.name ?? null;

    return { data: orderTaskFields(transformed) };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

// ─── SERVICE: GET ALL TASKS ───────────────────────────────────────────────────

/**
 * Fetches paginated Tasks for a builder with optional filters.
 * Also returns date-range and status counters for the builder.
 *
 * @returns {{ data: object }}
 */
export async function getAllTasksService({
  builderId,
  page = 1,
  limit = 25,
  name,
  due_date,
  status,
  priority,
  assignee_id,
  link_to,
  link_type,
  lead_id,
  date_filter,
  is_deleted,
  sort_by = "created_at",
  sort_order = "DESC",
}) {
  const { Task, Users, sequelize } = db;

  const pageValue = parseInt(page, 10);
  const limitValue = parseInt(limit, 10);
  const offset = (pageValue - 1) * limitValue;

  // ── Build where clause ─────────────────────────────────────────────────
  const where = { builder_id: builderId };

  if (is_deleted === "true" || is_deleted === true) {
    // If is_deleted is true, we show all data (no filter on is_deleted)
  } else {
    // Otherwise, default to showing only non-deleted data
    where.is_deleted = false;
  }
  if (name) {
    where.name = { [Op.iLike]: `%${name}%` };
  }
  if (due_date) {
    where.due_date = due_date;
  }
  if (status) {
    where.status = status;
  }
  if (priority) {
    where.priority = priority;
  }
  if (assignee_id) {
    const assigneeIds = (Array.isArray(assignee_id) ? assignee_id : [assignee_id])
      .flatMap((value) => String(value).split(","))
      .map((id) => id.trim())
      .filter(Boolean);
    if (assigneeIds.length > 0) {
      where.assignee_id = { [Op.in]: assigneeIds };
    }
  }
  if (link_to) {
    where.link_to = link_to;
  }
  if (link_type) {
    where.link_type = link_type;
  }
  if (lead_id) {
    where.lead_id = lead_id;
  }

  if (date_filter) {
    switch (date_filter) {
      case "today":
        where.due_date = { [Op.eq]: sequelize.literal("CURRENT_DATE") };
        where.status = { [Op.notIn]: ["Completed", "Cancelled", "Skipped"] };
        break;
      case "tomorrow":
        where.due_date = { [Op.eq]: sequelize.literal("CURRENT_DATE + INTERVAL '1 day'") };
        where.status = { [Op.notIn]: ["Completed", "Cancelled", "Skipped"] };
        break;
      case "this_week":
        where.due_date = {
          [Op.between]: [
            sequelize.literal("date_trunc('week', CURRENT_DATE)"),
            sequelize.literal("date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'"),
          ],
        };
        where.status = { [Op.notIn]: ["Completed", "Cancelled", "Skipped"] };
        break;
      case "next_week":
        where.due_date = {
          [Op.between]: [
            sequelize.literal("date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'"),
            sequelize.literal("date_trunc('week', CURRENT_DATE) + INTERVAL '13 days'"),
          ],
        };
        where.status = { [Op.notIn]: ["Completed", "Cancelled", "Skipped"] };
        break;
      case "overdue":
        where.due_date = { [Op.lt]: sequelize.literal("CURRENT_DATE") };
        where.status = { [Op.notIn]: ["Completed", "Cancelled", "Skipped"] };
        break;
      case "pending":
        where.status = { [Op.in]: ["Yet to Start", "In Progress"] };
        break;
    }
  }

  // ── Counter query (uses raw SQL — window/FILTER aggregations) ─────────
  const [counterRows] = await sequelize.query(
    `SELECT
      COUNT(*) AS all_count,
      COUNT(*) FILTER (WHERE t.due_date = CURRENT_DATE AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS today_count,
      COUNT(*) FILTER (WHERE t.due_date = CURRENT_DATE + INTERVAL '1 day' AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS tomorrow_count,
      COUNT(*) FILTER (WHERE t.due_date BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days' AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS this_week_count,
      COUNT(*) FILTER (WHERE t.due_date BETWEEN date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days' AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS next_week_count,
      COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS overdue_count,
      COUNT(*) FILTER (WHERE t.status IN ('Yet to Start','In Progress')) AS pending_count
    FROM task t
    WHERE t.builder_id = :builderId ${is_deleted === "true" || is_deleted === true ? "" : "AND t.is_deleted = false"}`,
    { replacements: { builderId } },
  );

  const counters = {
    allCount: Number(counterRows[0].all_count) || 0,
    todayCount: Number(counterRows[0].today_count) || 0,
    tomorrowCount: Number(counterRows[0].tomorrow_count) || 0,
    thisWeekCount: Number(counterRows[0].this_week_count) || 0,
    nextWeekCount: Number(counterRows[0].next_week_count) || 0,
    overdueCount: Number(counterRows[0].overdue_count) || 0,
    pendingCount: Number(counterRows[0].pending_count) || 0,
  };

  // ── Paginated fetch ────────────────────────────────────────────────────
  const { count, rows } = await Task.findAndCountAll({
    where,
    include: [
      { model: Users, as: "assignee", attributes: ["name"] },
      { model: Users, as: "createdByUser", attributes: ["name"] },
    ],
    order: [[sort_by, sort_order]],
    limit: limitValue,
    offset,
  });

  const tasks = rows.map((row) => {
    const plain = row.get({ plain: true });
    const camel = keysToCamelCase(plain);
    camel.assigneeName = plain.assignee?.name ?? null;
    camel.createdbyname = plain.createdByUser?.name ?? null;
    return orderTaskFields(camel);
  });

  return {
    data: {
      tasks,
      pagination: {
        currentPage: pageValue,
        totalPages: Math.ceil(count / limitValue),
        totalRecords: count,
        limit: limitValue,
      },
      counters,
    },
  };
}

// ─── SERVICE: DELETE TASK ─────────────────────────────────────────────────────

/**
 * Deletes a Task by ID after verifying builder ownership.
 *
 * @returns {{ success: true }|{ error: { status: number, message: string } }}
 */
export async function deleteTaskService({ task_id, builderId }) {
  const { Task, sequelize } = db;
  const transaction = await sequelize.transaction();

  try {
    const task = await Task.findOne({
      where: { task_id, builder_id: builderId },
      attributes: ["task_id", "builder_id", "lead_id", "name"],
      transaction,
    });

    if (!task) {
      await transaction.rollback();
      return { error: { status: 404, message: "Task not found or unauthorized" } };
    }

    await task.update({ is_deleted: true }, { transaction });
    await transaction.commit();

    // ── Fetch enriched data to return ──────────────────────────────────────
    const { Users } = db;
    const enriched = await Task.findOne({
      where: { task_id },
      include: [
        { model: Users, as: "assignee", attributes: ["name"] },
        { model: Users, as: "createdByUser", attributes: ["name"] },
      ],
    });

    const transformed = keysToCamelCase(enriched.get({ plain: true }));
    transformed.assigneeName = enriched.assignee?.name ?? null;
    transformed.createdbyname = enriched.createdByUser?.name ?? null;

    return { success: true, data: orderTaskFields(transformed) };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

// ─── SERVICE: UPDATE TASK ─────────────────────────────────────────────────────

/**
 * Partially updates a Task.
 * Validates assignee_id, link_to user, due_date, and handles S3 attachment replacement.
 *
 * @returns {{ data: object }|{ error: { status: number, message: string } }}
 */
export async function updateTaskService({
  task_id,
  builderId,
  userId,
  name,
  description,
  due_date,
  due_time,
  assignee_id,
  link_to,
  link_type,
  priority,
  status,
  newAttachFiles,
  clearAttachment,
}) {
  const { Task, Users, sequelize } = db;
  const transaction = await sequelize.transaction();

  try {
    // ── Find & authorize ───────────────────────────────────────────────────
    const task = await Task.findOne({
      where: { task_id, builder_id: builderId, is_deleted: false },
      transaction,
    });

    if (!task) {
      await transaction.rollback();
      return {
        error: {
          status: 404,
          message: "Task not found or you do not have permission to update it",
        },
      };
    }

    // ── Validate due_date ──────────────────────────────────────────────────
    if (due_date && !isValidDate(due_date)) {
      await transaction.rollback();
      return { error: { status: 400, message: `Invalid date: ${due_date}` } };
    }

    // ── Validate assignee_id ───────────────────────────────────────────────
    if (assignee_id) {
      const assignee = await Users.findOne({
        where: { users_id: assignee_id, is_deleted: false, is_verified: true },
        attributes: ["users_id"],
        transaction,
      });
      if (!assignee) {
        await transaction.rollback();
        return {
          error: {
            status: 400,
            message: "Invalid assignee_id. You can assign only your own builder users",
          },
        };
      }
    }

    // ── Validate link_to user ──────────────────────────────────────────────
    if (link_to) {
      const linkedUser = await Users.findOne({
        where: { users_id: link_to, is_deleted: false, is_verified: true },
        attributes: ["users_id"],
        transaction,
      });
      if (!linkedUser) {
        await transaction.rollback();
        return { error: { status: 400, message: "Invalid link_to user_id" } };
      }
    }

    // ── S3 attachment handling ─────────────────────────────────────────────
    let finalAttachFiles = undefined; // undefined = don't update the field

    if (clearAttachment) {
      // Explicitly clearing the attachment
      if (task.attach_files) {
        try {
          await deleteFromS3(task.attach_files);
        } catch (e) {
          console.error("Error deleting old attachment from S3:", e);
        }
      }
      finalAttachFiles = null;
    } else if (newAttachFiles) {
      // New file uploaded — delete old one if different
      if (task.attach_files && task.attach_files !== newAttachFiles) {
        try {
          await deleteFromS3(task.attach_files);
        } catch (e) {
          console.error("Error deleting old attachment from S3:", e);
        }
      }
      finalAttachFiles = newAttachFiles;
    }

    // ── Build update payload (only provided fields) ────────────────────────
    const updatePayload = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(due_date !== undefined && { due_date }),
      ...(due_time !== undefined && { due_time }),
      ...(priority !== undefined && { priority }),
      ...(status !== undefined && { status }),
      ...(assignee_id !== undefined && { assignee_id }),
      ...(link_to !== undefined && { link_to }),
      ...(link_type !== undefined && { link_type }),
      ...(finalAttachFiles !== undefined && { attach_files: finalAttachFiles }),
      updated_by: userId,
    };

    // updated_by is always set, so check if any real field is present
    const realFields = Object.keys(updatePayload).filter((k) => k !== "updated_by");
    if (realFields.length === 0) {
      await transaction.rollback();
      return { error: { status: 400, message: "No fields to update" } };
    }

    await task.update(updatePayload, { transaction });
    await transaction.commit();

    // ── Enrich: fetch assignee name and createdbyname ──────────────────────
    const enriched = await Task.findOne({
      where: { task_id: task.task_id },
      include: [
        { model: Users, as: "assignee", attributes: ["name"] },
        { model: Users, as: "createdByUser", attributes: ["name"] },
      ],
    });

    const transformed = keysToCamelCase(enriched.get({ plain: true }));
    transformed.assigneeName = enriched.assignee?.name ?? null;
    transformed.createdbyname = enriched.createdByUser?.name ?? null;

    return { data: orderTaskFields(transformed) };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}
