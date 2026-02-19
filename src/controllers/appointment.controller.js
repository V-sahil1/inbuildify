const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createAppointment = async (req, res) => {
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
      location_id,
      link_to,
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

    if (location_id) {
      const locationCheck = await client.query(
        `SELECT location_id 
         FROM location 
         WHERE location_id = $1 AND (company_id = $2 OR builder_id = $3)`,
        [location_id, companyId, builderId],
      );

      if (locationCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid location_id. Location not found for this builder/company.",
        );
      }
    }

    if (location_id) {
      const locationActiveCheck = await client.query(
        `SELECT location_id 
         FROM location 
         WHERE location_id = $1 AND (company_id = $2 OR builder_id = $3) AND status = true`,
        [location_id, companyId, builderId],
      );

      if (locationActiveCheck.rowCount === 0) {
        return errorResponse(res, 400, "Inactive location.");
      }
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
        location_id,
        link_to,
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
        $13
      )
      RETURNING 
        appointment_id,
        company_id,
        builder_id,
        title,
        date,
        start_time,
        end_time,
        link_to,
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
      location_id || null,
      link_to || null,
      select_users || [],
      notes || null,
      send_appointment_customer || false,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    let locationData = [];
    if (location_id) {
      const locationQuery = await client.query(
        `SELECT location_id, name FROM location WHERE location_id = $1`,
        [location_id],
      );
      if (locationQuery.rowCount > 0) {
        locationData = [
          {
            id: locationQuery.rows[0].location_id,
            name: locationQuery.rows[0].name,
          },
        ];
      }
    }

    let selectUsersData = [];
    if (select_users && select_users.length > 0) {
      const usersQuery = await client.query(
        `SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false`,
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

    const appointmentData = keysToCamelCase(result.rows[0]);

    const response = {
      appointmentId: appointmentData.appointmentId,
      companyId: appointmentData.companyId,
      builderId: appointmentData.builderId,
      title: appointmentData.title,
      date: appointmentData.date,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      location: locationData,
      linkTo: appointmentData.linkTo,
      selectUsers: selectUsersData,
      notes: appointmentData.notes,
      sendAppointmentCustomer: appointmentData.sendAppointmentCustomer,
      isDeleted: appointmentData.isDeleted,
      createdBy: appointmentData.createdBy,
      updatedBy: appointmentData.updatedBy,
      createdAt: appointmentData.createdAt,
      updatedAt: appointmentData.updatedAt,
    };

    return successResponse(res, response, "Appointment created successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating appointment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllAppointments = async (req, res) => {
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
    const { title, date, location_id, link_to, is_deleted } = req.query;

    let whereClauses = [];
    let values = [];
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

    if (date) {
      whereClauses.push(`a.date = $${idx}`);
      values.push(date);
      idx++;
    }

    if (location_id) {
      whereClauses.push(`a.location_id = $${idx}`);
      values.push(location_id);
      idx++;
    }

    if (link_to) {
      whereClauses.push(`a.link_to = $${idx}`);
      values.push(link_to);
      idx++;
    }

    if (is_deleted === undefined) {
      whereClauses.push(`a.is_deleted = false`);
    } else {
      whereClauses.push(`a.is_deleted = $${idx}`);
      values.push(is_deleted === "true");
      idx++;
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
        CASE 
          WHEN l.location_id IS NOT NULL THEN 
            json_build_object('id', l.location_id, 'name', l.name)
          ELSE '[]'::json
        END AS location,  
        a.link_to,
        a.select_users,
        a.notes,
        a.send_appointment_customer,
        a.is_deleted,
        a.created_by,
        a.updated_by,
        a.created_at,
        a.updated_at
      FROM appointment a
      LEFT JOIN location l ON a.location_id = l.location_id
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
            `SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false`,
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
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteAppointment = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const { appointment_id } = req.params;

    const checkQuery = `
      SELECT appointment_id, is_deleted
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

    const deleteQuery = `
      UPDATE appointment
      SET 
        is_deleted = TRUE,
        updated_at = NOW(),
        updated_by = $2
      WHERE appointment_id = $1
        AND (company_id = $3 OR builder_id = $4)
      RETURNING appointment_id, title, is_deleted, updated_at;
    `;

    const result = await client.query(deleteQuery, [
      appointment_id,
      userId,
      companyId,
      builderId,
    ]);

    return successResponse(res, {}, "Appointment deleted successfully.");
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
};

exports.updateAppointment = async (req, res) => {
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
      location_id,
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

    let newStartTime =
      start_time !== undefined ? start_time : existing.start_time;
    let newEndTime = end_time !== undefined ? end_time : existing.end_time;

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
          `SELECT users_id FROM users WHERE users_id = ANY($1) AND is_deleted = false`,
          [select_users],
        );

        if (userCheck.rowCount !== select_users.length) {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "One or more user IDs are invalid.");
        }
      }
    }

    if (location_id !== undefined) {
      const locationCheck = await client.query(
        `SELECT location_id FROM location WHERE location_id = $1 AND builder_id = $2`,
        [location_id, builderId],
      );
      if (locationCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid location_id.");
      }
    }

    if (location_id !== undefined) {
      const locationActiveCheck = await client.query(
        `SELECT location_id FROM location WHERE location_id = $1 AND status = true AND builder_id = $2`,
        [location_id, builderId],
      );
      if (locationActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive location.");
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
    if (location_id !== undefined) {
      fields.push(`location_id = $${index}`);
      values.push(location_id);
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

    fields.push(`updated_at = NOW()`);
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
        location_id,
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

    // Get location details if location_id exists
    let locationData = [];
    const updatedAppointment = updateResult.rows[0];

    // Check if location_id was updated in this request
    let locationIdToLookup = updatedAppointment.location_id;
    if (location_id !== undefined) {
      locationIdToLookup = location_id;
    }

    if (locationIdToLookup) {
      const locationQuery = await client.query(
        `SELECT location_id, name FROM location WHERE location_id = $1`,
        [locationIdToLookup],
      );
      if (locationQuery.rowCount > 0) {
        locationData = [
          {
            id: locationQuery.rows[0].location_id,
            name: locationQuery.rows[0].name,
          },
        ];
      }
    }

    // Get select_users details if users exist
    let selectUsersData = [];
    const selectUsersToLookup =
      select_users !== undefined
        ? select_users
        : updatedAppointment.select_users;
    if (selectUsersToLookup && selectUsersToLookup.length > 0) {
      const usersQuery = await client.query(
        `SELECT users_id, name FROM users WHERE users_id = ANY($1) AND is_deleted = false`,
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

    const appointmentData = keysToCamelCase(updatedAppointment);

    // Construct response with proper order and location object
    const response = {
      appointmentId: appointmentData.appointmentId,
      companyId: appointmentData.companyId,
      builderId: appointmentData.builderId,
      title: appointmentData.title,
      date: appointmentData.date,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      location: locationData,
      linkTo: appointmentData.linkTo,
      selectUsers: selectUsersData,
      notes: appointmentData.notes,
      sendAppointmentCustomer: appointmentData.sendAppointmentCustomer,
      isDeleted: appointmentData.isDeleted,
      createdBy: appointmentData.createdBy,
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
};

exports.searchUserBuilderTables = async (req, res) => {
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
        existingTables: existingTables,
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
};
