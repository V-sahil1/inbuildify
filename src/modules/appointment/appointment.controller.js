import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";

export async function createAppointment(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

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
    } = req.body;

    if (start_time >= end_time) {
      return errorResponse(
        res,
        400,
        "start_time must be earlier than end_time.",
      );
    }

    if (lead_id) {
      const leadCheck = await client.query(
        `SELECT leads_id 
         FROM leads 
         WHERE leads_id = $1 AND (company_id = $2 OR builder_id = $3)`,
        [lead_id, companyId, builderId],
      );

      if (leadCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid lead_id. Lead not found for this builder/company.",
        );
      }

      await checkLeadLockStatus(lead_id);
    }

    if (select_users && select_users.length > 0) {
      const userCheck = await client.query(
        `SELECT users_id 
         FROM users
         WHERE users_id = ANY($1) AND is_deleted = false`,
        [select_users],
      );

      if (userCheck.rowCount !== select_users.length) {
        return errorResponse(
          res,
          400,
          "One or more user IDs in select_users are invalid or do not belong to this builder/company.",
        );
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (date && !isValidDate(date)) {
      return errorResponse(res, 400, `Invalid date: ${date}`);
    }

    await client.query("BEGIN");

    const insertQuery = `
      INSERT INTO appointment (
        company_id,
        builder_id,
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
        created_by,
        updated_by
      )
      VALUES (
        $1, $2,
        $3, $4, $5, $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      RETURNING 
        appointment_id,
        company_id,
        builder_id,
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
        is_deleted,
        created_by,
        updated_by,
        created_at,
        updated_at
    `;

    const values = [
      companyId,
      builderId,
      title,
      date,
      start_time,
      end_time,
      location_text?.trim() || null,
      link_to || null,
      lead_id || null,
      select_users || [],
      notes || null,
      send_appointment_customer || false,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    let selectUsersData = [];
    if (select_users && select_users.length > 0) {
      const usersQuery = await client.query(
        "SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false",
        [select_users],
      );
      if (usersQuery.rowCount > 0) {
        selectUsersData = usersQuery.rows.map((user) => ({
          id: user.users_id,
          name: user.name,
        }));
      }
    }

    await client.query("COMMIT");

    // Log Activity
    if (lead_id) {
      await logActivity(client, {
        userId: userId,
        leadsId: lead_id,
        module: "Appointment",
        moduleId: result.rows[0].appointment_id,
        recordName: title,
        action: "CREATE",
        description: `Appointment created: ${title}`
      });
    }

    const appointmentData = keysToCamelCase(result.rows[0]);

    const creatorResult = await client.query(
      "SELECT name FROM users WHERE users_id = $1",
      [result.rows[0].created_by]
    );

    const response = {
      appointmentId: appointmentData.appointmentId,
      companyId: appointmentData.companyId,
      builderId: appointmentData.builderId,
      title: appointmentData.title,
      date: appointmentData.date,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      locationText: appointmentData.locationText ?? null,
      linkTo: appointmentData.linkTo,
      leadId: appointmentData.leadId,
      selectUsers: selectUsersData,
      notes: appointmentData.notes,
      sendAppointmentCustomer: appointmentData.sendAppointmentCustomer,
      isDeleted: appointmentData.isDeleted,
      createdBy: appointmentData.createdBy,
      createdbyname: creatorResult.rows[0]?.name || null,
      updatedBy: appointmentData.updatedBy,
      createdAt: appointmentData.createdAt,
      updatedAt: appointmentData.updatedAt,
    };

    return successResponse(res, response, "Appointment created successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating appointment:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllAppointments(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    let { page = 1, limit = 25 } = req.query;
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
    } = req.query;

    const whereClauses = [];
    const values = [];
    let idx = 1;

    if (builderId) {
      whereClauses.push(`a.builder_id = $${idx}`);
      values.push(builderId);
      idx++;
    } else {
      whereClauses.push(`a.company_id = $${idx}`);
      values.push(companyId);
      idx++;
    }

    if (title) {
      whereClauses.push(`LOWER(a.title) LIKE LOWER($${idx})`);
      values.push(`%${title}%`);
      idx++;
    }

    // Support exact date match OR date range via date_from/date_to
    if (date_from && date_to) {
      whereClauses.push(`a.date BETWEEN $${idx} AND $${idx + 1}`);
      values.push(date_from.slice(0, 10), date_to.slice(0, 10));
      idx += 2;
    } else if (date_from) {
      whereClauses.push(`a.date >= $${idx}`);
      values.push(date_from.slice(0, 10));
      idx++;
    } else if (date_to) {
      whereClauses.push(`a.date <= $${idx}`);
      values.push(date_to.slice(0, 10));
      idx++;
    } else if (date) {
      whereClauses.push(`a.date = $${idx}`);
      values.push(date);
      idx++;
    }

    if (location_text) {
      whereClauses.push(`a.location_text ILIKE $${idx}`);
      values.push(`%${location_text}%`);
      idx++;
    }

    if (link_to) {
      whereClauses.push(`a.link_to = $${idx}`);
      values.push(link_to);
      idx++;
    }

    if (lead_id) {
      whereClauses.push(`a.lead_id = $${idx}`);
      values.push(lead_id);
      idx++;
    }

    if (assignee_id) {
      whereClauses.push(`$${idx} = ANY(a.select_users)`);
      values.push(assignee_id);
      idx++;
    }

    // include_cancelled=true means include soft-deleted (cancelled) appointments
    if (include_cancelled === "true" || include_cancelled === true || is_deleted === "true" || is_deleted === true) {
      // include all records (active and deleted)
    } else {
      whereClauses.push("a.is_deleted = false");
    }

    const where =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM appointment a ${where}`;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT 
        a.appointment_id,
        a.company_id,
        a.builder_id,
        a.title,
        a.date,
        a.start_time,
        a.end_time,
        a.location_text,
        a.link_to,
        a.lead_id,
        a.select_users,
        a.notes,
        a.send_appointment_customer,
        a.is_deleted,
        a.created_by,
        (SELECT name FROM users WHERE users_id = a.created_by) AS createdbyname,
        a.updated_by,
        a.created_at,
        a.updated_at
      FROM appointment a
      ${where}
      ORDER BY a.date DESC, a.start_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await client.query(dataQuery, values);

    // Process results to add user details for select_users
    const processedResults = await Promise.all(
      result.rows.map(async (appointment) => {
        let selectUsersData = [];
        if (appointment.select_users && appointment.select_users.length > 0) {
          const usersQuery = await client.query(
            "SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false",
            [appointment.select_users],
          );
          if (usersQuery.rowCount > 0) {
            selectUsersData = usersQuery.rows.map((user) => ({
              id: user.users_id,
              name: user.name,
            }));
          }
        }

        return {
          ...appointment,
          select_users: selectUsersData,
        };
      }),
    );

    return successResponse(res, {
      appointment: keysToCamelCase(processedResults),
      totalRecords: total,
      currenPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching appointments:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

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

/**
 * Tab bucket counts aligned with frontend dayjs: week starts Sunday, local calendar dates.
 */
export async function getAppointmentTabCounts(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    const { anchor_date, title, assignee_id, include_cancelled, is_deleted } = req.query;

    const todayYmd =
      anchor_date && /^\d{4}-\d{2}-\d{2}$/.test(anchor_date)
        ? anchor_date
        : formatLocalYmd(new Date());

    const tomorrowYmd = addDaysYmd(todayYmd, 1);
    const thisWeekStart = startOfWeekSundayYmd(todayYmd);
    const thisWeekEnd = endOfWeekFromStartSundayYmd(thisWeekStart);
    const nextWeekStart = addDaysYmd(thisWeekStart, 7);
    const nextWeekEnd = addDaysYmd(thisWeekEnd, 7);

    const ranges = {
      today: [todayYmd, todayYmd],
      tomorrow: [tomorrowYmd, tomorrowYmd],
      thisWeek: [thisWeekStart, thisWeekEnd],
      nextWeek: [nextWeekStart, nextWeekEnd],
      pending: [todayYmd, null],
    };

    async function countBetween(dateFrom, dateTo) {
      const whereClauses = [];
      const vals = [];
      let idx = 1;

      if (builderId) {
        whereClauses.push(`a.builder_id = $${idx}`);
        vals.push(builderId);
        idx++;
      } else {
        whereClauses.push(`a.company_id = $${idx}`);
        vals.push(companyId);
        idx++;
      }

      if (title) {
        whereClauses.push(`LOWER(a.title) LIKE LOWER($${idx})`);
        vals.push(`%${title}%`);
        idx++;
      }

      if (assignee_id) {
        whereClauses.push(`$${idx} = ANY(a.select_users)`);
        vals.push(assignee_id);
        idx++;
      }

      if (include_cancelled === "true" || include_cancelled === true || is_deleted === "true" || is_deleted === true) {
        // include all records
      } else {
        whereClauses.push("a.is_deleted = false");
      }

      if (dateFrom && dateTo) {
        whereClauses.push(`a.date BETWEEN $${idx} AND $${idx + 1}`);
        vals.push(dateFrom, dateTo);
        idx += 2;
      } else if (dateFrom) {
        whereClauses.push(`a.date >= $${idx}`);
        vals.push(dateFrom);
        idx++;
      }

      const where =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const q = `SELECT COUNT(*)::int AS c FROM appointment a ${where}`;
      const r = await client.query(q, vals);
      return r.rows[0].c;
    }

    const [all, today, tomorrow, thisWeek, nextWeek, pending] = await Promise.all([
      countBetween(null, null),
      countBetween(ranges.today[0], ranges.today[1]),
      countBetween(ranges.tomorrow[0], ranges.tomorrow[1]),
      countBetween(ranges.thisWeek[0], ranges.thisWeek[1]),
      countBetween(ranges.nextWeek[0], ranges.nextWeek[1]),
      countBetween(ranges.pending[0], ranges.pending[1]),
    ]);

    return successResponse(res, {
      all,
      today,
      tomorrow,
      thisWeek,
      nextWeek,
      pending,
    });
  } catch (err) {
    console.error("Error fetching appointment tab counts:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteAppointment(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const { appointment_id } = req.params;

    const checkQuery = `
      SELECT *
      FROM appointment
      WHERE appointment_id = $1
        AND (company_id = $2 OR builder_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      appointment_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Appointment not found or access denied.");
    }

    if (checkResult.rows[0].is_deleted) {
      return errorResponse(res, 400, "Appointment is already deleted.");
    }

    await checkLeadLockStatus(checkResult.rows[0].lead_id);

    const deleteQuery = `
      UPDATE appointment
      SET 
        is_deleted = TRUE,
        updated_at = NOW(),
        updated_by = $2
      WHERE appointment_id = $1
        AND (company_id = $3 OR builder_id = $4)
      RETURNING *;
    `;

    const result = await client.query(deleteQuery, [
      appointment_id,
      userId,
      companyId,
      builderId,
    ]);

    const appointmentData = keysToCamelCase(result.rows[0]);

    // Get select_users details if users exist
    let selectUsersData = [];
    if (appointmentData.selectUsers && appointmentData.selectUsers.length > 0) {
      const usersQuery = await client.query(
        "SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false",
        [appointmentData.selectUsers],
      );
      if (usersQuery.rowCount > 0) {
        selectUsersData = usersQuery.rows.map((user) => ({
          id: user.users_id,
          name: user.name,
        }));
      }
    }

    // Get creator name
    const creatorResult = await client.query(
      "SELECT name FROM users WHERE users_id = $1",
      [result.rows[0].created_by]
    );

    const response = {
      appointmentId: appointmentData.appointmentId,
      companyId: appointmentData.companyId,
      builderId: appointmentData.builderId,
      title: appointmentData.title,
      date: appointmentData.date,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      locationText: appointmentData.locationText ?? null,
      linkTo: appointmentData.linkTo,
      leadId: appointmentData.leadId,
      selectUsers: selectUsersData,
      notes: appointmentData.notes,
      sendAppointmentCustomer: appointmentData.sendAppointmentCustomer,
      isDeleted: appointmentData.isDeleted,
      createdBy: appointmentData.createdBy,
      createdbyname: creatorResult.rows[0]?.name || null,
      updatedBy: appointmentData.updatedBy,
      createdAt: appointmentData.createdAt,
      updatedAt: appointmentData.updatedAt,
    };

    // Log Activity
    if (checkResult.rows[0].lead_id) {
      await logActivity(client, {
        userId: userId,
        leadsId: checkResult.rows[0].lead_id,
        module: "Appointment",
        moduleId: appointment_id,
        recordName: checkResult.rows[0].title,
        action: "DELETE",
        description: `Appointment deleted: ${checkResult.rows[0].title}`
      });
    }

    return successResponse(res, response, "Appointment deleted successfully.");
  } catch (err) {
    console.error("Error soft deleting appointment:", err);
    return errorResponse(
      res,
      500,
      err.message || "Failed to delete appointment.",
    );
  } finally {
    client.release();
  }
}

export async function updateAppointment(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { user_id } = req.user;
    const { appointment_id } = req.params;

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
    } = req.body;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        403,
        "Unauthorized. Builder or company login required.",
      );
    }

    if (!appointment_id) {
      return errorResponse(res, 400, "Appointment ID is required.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT *
      FROM appointment
      WHERE appointment_id = $1 
      AND (builder_id = $2 OR company_id = $3)
      AND is_deleted = false
      FOR UPDATE;
    `;

    const checkResult = await client.query(checkQuery, [
      appointment_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Appointment not found or access denied.");
    }

    const existing = checkResult.rows[0];

    await checkLeadLockStatus(existing.lead_id);

    const newStartTime =
      start_time !== undefined ? start_time : existing.start_time;
    const newEndTime = end_time !== undefined ? end_time : existing.end_time;

    if (start_time !== undefined && end_time === undefined) {
      if (newStartTime >= newEndTime) {
        return errorResponse(
          res,
          400,
          "start_time must be earlier than existing end_time.",
        );
      }
    }

    if (end_time !== undefined && start_time === undefined) {
      if (newStartTime >= newEndTime) {
        return errorResponse(
          res,
          400,
          "end_time must be later than existing start_time.",
        );
      }
    }

    if (start_time !== undefined && end_time !== undefined) {
      if (newStartTime >= newEndTime) {
        return errorResponse(
          res,
          400,
          "start_time must be earlier than end_time.",
        );
      }
    }

    if (select_users !== undefined) {
      if (!Array.isArray(select_users)) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "`select_users` must be an array.");
      }

      if (select_users.length > 0) {
        const userCheck = await client.query(
          "SELECT users_id FROM users WHERE users_id = ANY($1) AND is_deleted = false",
          [select_users],
        );

        if (userCheck.rowCount !== select_users.length) {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "One or more user IDs are invalid.");
        }
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (date && !isValidDate(date)) {
      return errorResponse(res, 400, `Invalid date: ${date}`);
    }

    const fields = [];
    const values = [];
    let index = 4;

    if (title !== undefined) {
      fields.push(`title = $${index}`);
      values.push(title);
      index++;
    }
    if (date !== undefined) {
      fields.push(`date = $${index}`);
      values.push(date);
      index++;
    }
    if (start_time !== undefined) {
      fields.push(`start_time = $${index}`);
      values.push(start_time);
      index++;
    }
    if (end_time !== undefined) {
      fields.push(`end_time = $${index}`);
      values.push(end_time);
      index++;
    }
    if (location_text !== undefined) {
      fields.push(`location_text = $${index}`);
      values.push(
        location_text === null || location_text === ""
          ? null
          : String(location_text).trim(),
      );
      index++;
    }
    if (link_to !== undefined) {
      fields.push(`link_to = $${index}`);
      values.push(link_to);
      index++;
    }
    if (select_users !== undefined) {
      fields.push(`select_users = $${index}`);
      values.push(select_users);
      index++;
    }
    if (notes !== undefined) {
      fields.push(`notes = $${index}`);
      values.push(notes);
      index++;
    }
    if (send_appointment_customer !== undefined) {
      fields.push(`send_appointment_customer = $${index}`);
      values.push(send_appointment_customer);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided for update.");
    }

    fields.push("updated_at = NOW()");
    fields.push(`updated_by = $${index}`);
    values.push(user_id);
    index++;

    const updateQuery = `
      UPDATE appointment
      SET ${fields.join(", ")}
      WHERE appointment_id = $1 
      AND (builder_id = $2 OR company_id = $3)
      RETURNING 
        appointment_id,
        company_id,
        builder_id,
        title,
        date,
        start_time,
        end_time,
        location_text,
        link_to,
        select_users,
        notes,
        send_appointment_customer,
        is_deleted,
        created_by,
        updated_by,
        created_at,
        updated_at;
    `;

    const finalValues = [appointment_id, builderId, companyId, ...values];

    const updateResult = await client.query(updateQuery, finalValues);

    const updatedAppointment = updateResult.rows[0];

    // Get select_users details if users exist
    let selectUsersData = [];
    const selectUsersToLookup =
      select_users !== undefined
        ? select_users
        : updatedAppointment.select_users;
    if (selectUsersToLookup && selectUsersToLookup.length > 0) {
      const usersQuery = await client.query(
        "SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false",
        [selectUsersToLookup],
      );
      if (usersQuery.rowCount > 0) {
        selectUsersData = usersQuery.rows.map((user) => ({
          id: user.users_id,
          name: user.name,
        }));
      }
    }

    await client.query("COMMIT");

    // Log Activity
    if (existing.lead_id) {
      await compareAndLogUpdates(client, {
        userId: user_id,
        leadsId: existing.lead_id,
        module: "Appointment",
        moduleId: appointment_id,
        recordName: updatedAppointment.title,
        oldData: keysToCamelCase(existing),
        newData: keysToCamelCase(updatedAppointment)
      });
    }

    const appointmentData = keysToCamelCase(updatedAppointment);

    const creatorResult = await client.query(
      "SELECT name FROM users WHERE users_id = $1",
      [updatedAppointment.created_by]
    );

    const response = {
      appointmentId: appointmentData.appointmentId,
      companyId: appointmentData.companyId,
      builderId: appointmentData.builderId,
      title: appointmentData.title,
      date: appointmentData.date,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      locationText: appointmentData.locationText ?? null,
      linkTo: appointmentData.linkTo,
      selectUsers: selectUsersData,
      notes: appointmentData.notes,
      sendAppointmentCustomer: appointmentData.sendAppointmentCustomer,
      isDeleted: appointmentData.isDeleted,
      createdBy: appointmentData.createdBy,
      createdbyname: creatorResult.rows[0]?.name || null,
      updatedBy: appointmentData.updatedBy,
      createdAt: appointmentData.createdAt,
      updatedAt: appointmentData.updatedAt,
    };

    return successResponse(res, response, "Appointment updated successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating appointment:", err);
    return errorResponse(
      res,
      500,
      err.message || "Failed to update appointment.",
    );
  } finally {
    client.release();
  }
}

export async function searchUserBuilderTables(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { search } = req.query;

    if (!search || search.trim().length < 2) {
      return errorResponse(
        res,
        400,
        "Search term must be at least 2 characters long.",
      );
    }

    const searchTerm = `%${search.trim().toLowerCase()}%`;

    // First, find the user by name
    const userQuery = `
      SELECT users_id, name, email, builder_id
      FROM users
      WHERE (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)
        AND is_deleted = false
      LIMIT 1
    `;

    const userResult = await client.query(userQuery, [searchTerm]);

    if (userResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No user found with the provided name or email.",
      );
    }

    const foundUser = userResult.rows[0];
    const userBuilderId = foundUser.builder_id;

    // Check if builder exists in construction, users, and sales tables
    const tableCheckQuery = `
      SELECT 'construction_type' as table_name, COUNT(*) as count
      FROM construction_type
      WHERE builder_id = $1
      
      UNION ALL
      
      SELECT 'users' as table_name, COUNT(*) as count
      FROM users
      WHERE builder_id = $1 AND is_deleted = false
      
      UNION ALL
      
      SELECT 'sales_process' as table_name, COUNT(*) as count
      FROM sales_process
      WHERE builder_id = $1
    `;

    const tableResult = await client.query(tableCheckQuery, [userBuilderId]);

    const existingTables = tableResult.rows
      .filter((row) => parseInt(row.count) > 0)
      .map((row) => row.table_name);

    if (existingTables.length === 0) {
      return errorResponse(
        res,
        404,
        `No records found for user "${foundUser.name}" in construction, users, or sales tables.`,
      );
    }

    return successResponse(
      res,
      {
        userName: foundUser.name,
        builderId: userBuilderId,
        existingTables,
        searchTerm: search,
      },
      "User builder table existence checked successfully.",
    );
  } catch (err) {
    console.error("Error searching user builder tables:", err);
    return errorResponse(
      res,
      500,
      err.message || "Failed to search user builder tables.",
    );
  } finally {
    client.release();
  }
}
