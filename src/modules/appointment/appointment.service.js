import db from "../../config/database/models/postgre-models/index.js";
import { Op } from "sequelize";
import { keysToCamelCase } from "../../utils/common.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";
import appointmentEmailQueue from "../../workers/appointmentEmailWorker.js";



/**
 * APPOINTMENT SERVICE
 * Contains all business logic and Sequelize operations.
 */

function formatLocalYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd, days) {
  const [y, mo, da] = ymd.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  return formatLocalYmd(d);
}

function startOfWeekSundayYmd(ymd) {
  const [y, mo, da] = ymd.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return formatLocalYmd(d);
}

function endOfWeekFromStartSundayYmd(startYmd) {
  return addDaysYmd(startYmd, 6);
}

function isValidDate(dateString) {
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

export async function createAppointment(currentUser, body) {
  const { Appointment, Leads, Users, Builder, NotificationTemplate, sequelize } = db;
  const transaction = await sequelize.transaction();
  try {
    const builderId = currentUser?.builder_id;
    const companyId = currentUser?.company_id;
    const userId = currentUser?.user_id;

    const {
      title,
      date,
      start_time,
      end_time,
      location_text,
      link_to,
      lead_id,
      select_users,
      notes,
      send_appointment_customer,
    } = body;

    if (start_time >= end_time) {
      throw { status: 400, message: "start_time must be earlier than end_time." };
    }

    let lead = null;
    if (lead_id) {
      lead = await Leads.findOne({
        where: {
          leads_id: lead_id,
          [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
        },
        transaction,
      });
      if (!lead) {
        throw {
          status: 400,
          message: "Invalid lead_id. Lead not found for this builder/company.",
        };
      }

      await checkLeadLockStatus(lead_id);
    }

    if (select_users && select_users.length > 0) {
      const users = await Users.findAll({
        where: {
          users_id: { [Op.in]: select_users },
          is_deleted: false,
        },
      });

      if (users.length !== select_users.length) {
        throw {
          status: 400,
          message: "One or more user IDs in select_users are invalid or do not belong to this builder/company.",
        };
      }
    }

    if (date && !isValidDate(date)) {
      throw { status: 400, message: `Invalid date: ${date}` };
    }

    const appointment = await Appointment.create({
      company_id: companyId,
      builder_id: builderId,
      title,
      date,
      start_time,
      end_time,
      location_text: location_text?.trim() || null,
      link_to: link_to || null,
      lead_id: lead_id || null,
      select_users: select_users || [],
      notes: notes || null,
      send_appointment_customer: send_appointment_customer || false,
      created_by: userId,
      updated_by: userId,
    }, { transaction });

    let selectUsersData = [];
    if (select_users && select_users.length > 0) {
      const users = await Users.findAll({
        where: { users_id: { [Op.in]: select_users }, is_deleted: false },
        attributes: ["users_id", "name"],
      });
      selectUsersData = users.map((u) => ({
        id: u.users_id,
        name: u.name,
      }));
    }

    await transaction.commit();

    // Log Activity
    if (lead_id) {
      await logActivity(null, {
        userId,
        leadsId: lead_id,
        module: "Appointment",
        moduleId: appointment.appointment_id,
        recordName: title,
        action: "CREATE",
        description: `Appointment created: ${title}`,
      });
    }

    if (send_appointment_customer && lead_id && lead && lead.email) {
      let isExpired = false;
      if (appointment.date && appointment.start_time) {
        const dateStr = typeof appointment.date === "string" ? appointment.date : new Date(appointment.date).toISOString().slice(0, 10);
        const timeStr = typeof appointment.start_time === "string" ? appointment.start_time : String(appointment.start_time);
        const apptDateTime = new Date(`${dateStr}T${timeStr}`);
        if (!isNaN(apptDateTime.getTime())) {
          isExpired = apptDateTime < new Date();
        }
      }

      if (!isExpired) {
        appointmentEmailQueue.add(
          "appointmentEmail",
          {
            appointmentId: appointment.appointment_id,
            leadId: lead_id,
            builderId,
            companyId,
            userId,
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: true,
          }
        ).catch(err => console.error("Error adding appointment email job:", err));
      } else {
        console.log(`[createAppointment] Skipping appointment email queueing because appointment ${appointment.appointment_id} is in the past/expired.`);
      }
    }

    const result = keysToCamelCase(appointment.get({ plain: true }));
    const creator = await Users.findByPk(appointment.created_by, {
      attributes: ["name"],
    });

    return {
      ...result,
      selectUsers: selectUsersData,
      createdbyname: creator?.name || null,
    };
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    throw error;
  }
}

export async function getAllAppointments(currentUser, query) {
  const { Appointment, Users } = db;
  const builderId = currentUser?.builder_id;
  const companyId = currentUser?.company_id;

  if (!builderId && !companyId) {
    throw {
      status: 401,
      message: "Unauthorized: Missing builder or company ID.",
    };
  }

  let { page = 1, limit = 25 } = query;
  page = parseInt(page);
  limit = parseInt(limit);
  const offset = (page - 1) * limit;

  const {
    title,
    date,
    date_from,
    date_to,
    location_text,
    link_to,
    lead_id,
    assignee_id,
    include_cancelled,
    is_deleted,
  } = query;

  const orConditions = [];
  if (builderId) orConditions.push({ builder_id: builderId });
  if (companyId) orConditions.push({ company_id: companyId });

  const where = {
    [Op.or]: orConditions.length ? orConditions : [{ appointment_id: null }],
  };

  if (title) {
    where.title = { [Op.iLike]: `%${title}%` };
  }

  if (date_from && date_to) {
    where.date = {
      [Op.between]: [date_from.slice(0, 10), date_to.slice(0, 10)],
    };
  } else if (date_from) {
    where.date = { [Op.gte]: date_from.slice(0, 10) };
  } else if (date_to) {
    where.date = { [Op.lte]: date_to.slice(0, 10) };
  } else if (date) {
    where.date = date;
  }

  if (location_text) {
    where.location_text = { [Op.iLike]: `%${location_text}%` };
  }
  if (link_to) {
    where.link_to = link_to;
  }
  if (lead_id) {
    where.lead_id = lead_id;
  }
  if (assignee_id) {
    where.select_users = { [Op.contains]: [assignee_id] };
  }

  if (
    include_cancelled === "true" ||
    include_cancelled === true ||
    is_deleted === "true" ||
    is_deleted === true
  ) {
    // Show all: skip adding is_deleted filter to where clause
  } else {
    // Default: Show only non-deleted
    where.is_deleted = false;
  }

  const { count, rows } = await Appointment.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ["date", "DESC"],
      ["start_time", "DESC"],
    ],
  });

  const processedResults = await Promise.all(
    rows.map(async (row) => {
      const appointment = row.get({ plain: true });
      let selectUsersData = [];
      if (appointment.select_users && appointment.select_users.length > 0) {
        const users = await Users.findAll({
          where: {
            users_id: { [Op.in]: appointment.select_users },
            is_deleted: false,
          },
          attributes: ["users_id", "name"],
        });
        selectUsersData = users.map((u) => ({
          id: u.users_id,
          name: u.name,
        }));
      }

      const creator = await Users.findByPk(appointment.created_by, {
        attributes: ["name"],
      });

      return {
        ...appointment,
        select_users: selectUsersData,
        createdbyname: creator?.name || null,
      };
    }),
  );

  return {
    appointment: keysToCamelCase(processedResults),
    totalRecords: count,
    currentPage: page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
}

export async function getAppointmentTabCounts(currentUser, query) {
  const { Appointment } = db;
  const builderId = currentUser?.builder_id;
  const companyId = currentUser?.company_id;

  if (!builderId && !companyId) {
    throw {
      status: 401,
      message: "Unauthorized: Missing builder or company ID.",
    };
  }

  const { anchor_date, title, assignee_id, include_cancelled } = query;

  const todayYmd =
    anchor_date && /^\d{4}-\d{2}-\d{2}$/.test(anchor_date)
      ? anchor_date
      : formatLocalYmd(new Date());

  const tomorrowYmd = addDaysYmd(todayYmd, 1);
  const thisWeekStart = startOfWeekSundayYmd(todayYmd);
  const thisWeekEnd = endOfWeekFromStartSundayYmd(thisWeekStart);
  const nextWeekStart = addDaysYmd(thisWeekStart, 7);
  const nextWeekEnd = addDaysYmd(thisWeekEnd, 7);

  const baseWhere = {};
  if (builderId) {
    baseWhere.builder_id = builderId;
  } else {
    baseWhere.company_id = companyId;
  }

  if (title) {
    baseWhere.title = { [Op.iLike]: `%${title}%` };
  }
  if (assignee_id) {
    baseWhere.select_users = { [Op.contains]: [assignee_id] };
  }

  if (!(include_cancelled === "true" || include_cancelled === true)) {
    baseWhere.is_deleted = false;
  }

  const countBetween = async (dateFrom, dateTo) => {
    const where = { ...baseWhere };
    if (dateFrom && dateTo) {
      where.date = { [Op.between]: [dateFrom, dateTo] };
    } else if (dateFrom) {
      where.date = { [Op.gte]: dateFrom };
    }
    return await Appointment.count({ where });
  };

  const [all, today, tomorrow, thisWeek, nextWeek, pending] =
    await Promise.all([
      countBetween(null, null),
      countBetween(todayYmd, todayYmd),
      countBetween(tomorrowYmd, tomorrowYmd),
      countBetween(thisWeekStart, thisWeekEnd),
      countBetween(nextWeekStart, nextWeekEnd),
      countBetween(todayYmd, null),
    ]);

  return {
    all,
    today,
    tomorrow,
    thisWeek,
    nextWeek,
    pending,
  };
}

export async function deleteAppointment(currentUser, appointmentId) {
  const { Appointment, Leads, Users } = db;
  const builderId = currentUser?.builder_id;
  const companyId = currentUser?.company_id;
  const userId = currentUser?.user_id;

  const where = {
    appointment_id: appointmentId,
    [Op.or]: [{ builder_id: builderId }, { company_id: companyId }],
  };

  const appointment = await Appointment.findOne({ 
    where,
    include: [{ model: Leads, as: "lead", attributes: ["leads_id"] }]
  });

  if (!appointment) {
    throw { status: 404, message: "Appointment not found or access denied." };
  }

  if (appointment.is_deleted) {
    throw { status: 400, message: "Appointment is already deleted." };
  }

  if (appointment.lead_id) {
    await checkLeadLockStatus(appointment.lead_id);
  }

  await appointment.update({
    is_deleted: true,
    updated_by: userId,
  });

  // Log Activity
  if (appointment.lead_id) {
    await logActivity(null, {
      userId,
      leadsId: appointment.lead_id,
      module: "Appointment",
      moduleId: appointmentId,
      recordName: appointment.title,
      action: "DELETE",
      description: `Appointment deleted: ${appointment.title}`,
    });
  }

  // ── Fetch enriched data to return ──────────────────────────────────────
  const enriched = await Appointment.findByPk(appointmentId, {
    include: [{ model: Users, as: "createdByUser", attributes: ["name"] }],
  });

  const plain = enriched.get({ plain: true });

  let selectUsersData = [];
  if (plain.select_users && plain.select_users.length > 0) {
    const users = await Users.findAll({
      where: {
        users_id: { [Op.in]: plain.select_users },
        is_deleted: false,
      },
      attributes: ["users_id", "name"],
    });
    selectUsersData = users.map((u) => ({
      id: u.users_id,
      name: u.name,
    }));
  }

  const result = {
    ...keysToCamelCase(plain),
    selectUsers: selectUsersData,
    createdbyname: plain.createdByUser?.name || null,
  };

  // Remove unwanted snake_case keys that might have stayed
  delete result.select_users;

  return result;
}

export async function updateAppointment(currentUser, appointmentId, body) {
  const { Appointment, Users, Leads, Builder, NotificationTemplate, sequelize } = db;
  const transaction = await sequelize.transaction();
  try {
    const builderId = currentUser?.builder_id;
    const companyId = currentUser?.company_id;
    const userId = currentUser?.user_id;

    if (!builderId && !companyId) {
      throw {
        status: 403,
        message: "Unauthorized. Builder or company login required.",
      };
    }

    const where = {
      appointment_id: appointmentId,
      [Op.or]: [{ builder_id: builderId }, { company_id: companyId }],
      is_deleted: false,
    };

    const existing = await Appointment.findOne({
      where,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!existing) {
      throw { status: 404, message: "Appointment not found or access denied." };
    }

    if (existing.lead_id) {
      await checkLeadLockStatus(existing.lead_id);
    }

    let lead = null;
    if (existing.lead_id) {
      lead = await Leads.findOne({
        where: {
          leads_id: existing.lead_id,
          [Op.or]: [{ company_id: companyId }, { builder_id: builderId }],
        },
        transaction,
      });
    }

    const {
      title,
      date,
      start_time,
      end_time,
      location_text,
      link_to,
      select_users,
      notes,
      send_appointment_customer,
    } = body;

    const newStartTime =
      start_time !== undefined ? start_time : existing.start_time;
    const newEndTime = end_time !== undefined ? end_time : existing.end_time;

    if (newStartTime >= newEndTime) {
      throw {
        status: 400,
        message: "start_time must be earlier than end_time.",
      };
    }

    if (select_users !== undefined) {
      if (!Array.isArray(select_users)) {
        throw { status: 400, message: "`select_users` must be an array." };
      }
      if (select_users.length > 0) {
        const userCount = await Users.count({
          where: { users_id: { [Op.in]: select_users }, is_deleted: false },
          transaction,
        });
        if (userCount !== select_users.length) {
          throw { status: 400, message: "One or more user IDs are invalid." };
        }
      }
    }

    if (date && !isValidDate(date)) {
      throw { status: 400, message: `Invalid date: ${date}` };
    }

    const updateData = {};
    if (title !== undefined) {
      updateData.title = title;
    }
    if (date !== undefined) {
      updateData.date = date;
    }
    if (start_time !== undefined) {
      updateData.start_time = start_time;
    }
    if (end_time !== undefined) {
      updateData.end_time = end_time;
    }
    if (location_text !== undefined) {
      updateData.location_text = location_text?.trim() || null;
    }
    if (link_to !== undefined) {
      updateData.link_to = link_to;
    }
    if (select_users !== undefined) {
      updateData.select_users = select_users;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (send_appointment_customer !== undefined) {
      updateData.send_appointment_customer = send_appointment_customer;
    }

    if (Object.keys(updateData).length === 0) {
      throw { status: 400, message: "No fields provided for update." };
    }

    updateData.updated_by = userId;

    await Appointment.update(updateData, { where, transaction });

    const updated = await Appointment.findByPk(appointmentId, {
      transaction,
    });
    const updatedPlain = updated.get({ plain: true });

    let selectUsersData = [];
    if (updatedPlain.select_users && updatedPlain.select_users.length > 0) {
      const users = await Users.findAll({
        where: {
          users_id: { [Op.in]: updatedPlain.select_users },
          is_deleted: false,
        },
        attributes: ["users_id", "name"],
        transaction,
      });
      selectUsersData = users.map((u) => ({
        id: u.users_id,
        name: u.name,
      }));
    }

    const creator = await Users.findByPk(updatedPlain.created_by, {
      attributes: ["name"],
      transaction,
    });

    await transaction.commit();

    // Log Activity
    if (existing.lead_id) {
      await compareAndLogUpdates(null, {
        userId,
        leadsId: existing.lead_id,
        module: "Appointment",
        moduleId: appointmentId,
        recordName: updatedPlain.title,
        oldData: keysToCamelCase(existing.get({ plain: true })),
        newData: keysToCamelCase(updatedPlain),
      });
    }

    if (send_appointment_customer && existing.lead_id && lead && lead.email) {
      let isExpired = false;
      if (updatedPlain.date && updatedPlain.start_time) {
        const dateStr = typeof updatedPlain.date === "string" ? updatedPlain.date : new Date(updatedPlain.date).toISOString().slice(0, 10);
        const timeStr = typeof updatedPlain.start_time === "string" ? updatedPlain.start_time : String(updatedPlain.start_time);
        const apptDateTime = new Date(`${dateStr}T${timeStr}`);
        if (!isNaN(apptDateTime.getTime())) {
          isExpired = apptDateTime < new Date();
        }
      }

      if (!isExpired) {
        appointmentEmailQueue.add(
          "appointmentEmail",
          {
            appointmentId: updatedPlain.appointment_id,
            leadId: existing.lead_id,
            builderId,
            companyId,
            userId,
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: true,
          }
        ).catch(err => console.error("Error adding appointment email job:", err));
      } else {
        console.log(`[updateAppointment] Skipping appointment email queueing because appointment ${appointmentId} is in the past/expired.`);
      }
    }

    const result = keysToCamelCase(updatedPlain);
    return {
      appointmentId: result.appointmentId,
      companyId: result.companyId,
      builderId: result.builderId,
      title: result.title,
      date: result.date,
      startTime: result.startTime,
      endTime: result.endTime,
      locationText: result.locationText ?? null,
      linkTo: result.linkTo,
      selectUsers: selectUsersData,
      notes: result.notes,
      sendAppointmentCustomer: result.sendAppointmentCustomer,
      isDeleted: result.isDeleted,
      createdBy: result.createdBy,
      createdbyname: creator?.name || null,
      updatedBy: result.updatedBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    throw error;
  }
}

export async function searchUserBuilderTables(query) {
  const { Users, ConstructionType, SalesProcess } = db;
  const { search } = query;

  if (!search || search.trim().length < 2) {
    throw {
      status: 400,
      message: "Search term must be at least 2 characters long.",
    };
  }

  const searchTerm = search.trim();
  const users = await Users.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: `%${searchTerm}%` } },
        { email: { [Op.iLike]: `%${searchTerm}%` } },
      ],
      is_deleted: false,
    },
    limit: 1,
  });

  if (users.length === 0) {
    throw {
      status: 404,
      message: "No user found with the provided name or email.",
    };
  }

  const foundUser = users[0];
  const userBuilderId = foundUser.builder_id;

  const existingTables = [];
  const [constCount, userCount, salesCount] = await Promise.all([
    ConstructionType.count({ where: { builder_id: userBuilderId } }),
    Users.count({
      where: { builder_id: userBuilderId, is_deleted: false },
    }),
    SalesProcess.count({ where: { builder_id: userBuilderId } }),
  ]);

  if (constCount > 0) {
    existingTables.push("construction_type");
  }
  if (userCount > 0) {
    existingTables.push("users");
  }
  if (salesCount > 0) {
    existingTables.push("sales_process");
  }

  if (existingTables.length === 0) {
    throw {
      status: 404,
      message: `No records found for user "${foundUser.name}" in construction, users, or sales tables.`,
    };
  }

  return {
    userName: foundUser.name,
    builderId: userBuilderId,
    existingTables,
    searchTerm: search,
  };
}

export default {
  createAppointment,
  getAllAppointments,
  getAppointmentTabCounts,
  deleteAppointment,
  updateAppointment,
  searchUserBuilderTables,
};
