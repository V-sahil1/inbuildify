import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import db from "../../config/database/models/postgre-models/index.js";
import { QueryTypes } from "sequelize";

export async function createTodo(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 400, "Invalid builder or company");
    }

    const {
      job_id,
      task_name,
      supplier_id,
      booking_date,
      start_date,
      finish_date,
      site_supervisor_id,
      subject,
      message,
      status = "Pending",
    } = req.body;

    if (!supplier_id) {
      return errorResponse(res, 400, "supplier_id is required");
    }

    const supplier = await db.Supplier.findOne({
      where: { supplier_id, builder_id: builderId, company_id: companyId, status: true },
      attributes: ["supplier_id"],
    });

    if (!supplier) {
      return errorResponse(res, 400, "Invalid supplier_id");
    }

    const todo = await db.Todo.create({
      job_id: job_id || null,
      task_name,
      supplier_id,
      booking_date: booking_date || null,
      start_date: start_date || null,
      finish_date: finish_date || null,
      site_supervisor_id: null,
      subject: subject || null,
      message: message || null,
      status,
      builder_id: builderId,
      company_id: companyId,
      created_by: createdBy,
      updated_by: createdBy,
    });

    return successResponse(res, keysToCamelCase(todo.toJSON()), "Todo created successfully");
  } catch (err) {
    console.error("Error creating todo:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  }
}

export async function getAllTodos(req, res) {
  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID missing from token");
    }

    const {
      page = 1,
      limit = 25,
      task_name,
      job_address,
      site_supervisor_id,
      supplier_id,
      booking_date_from,
      booking_date_to,
      start_date_from,
      start_date_to,
      status,
      date_filter,
    } = req.query;

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const conditions = ["t.builder_id = :builderId"];
    const replacements = { builderId };

    if (task_name) {
      conditions.push("LOWER(t.task_name) LIKE LOWER(:taskName)");
      replacements.taskName = `%${task_name}%`;
    }
    if (job_address) {
      conditions.push(`LOWER(
        COALESCE(
          NULLIF(TRIM(
            CONCAT_WS(', ',
              NULLIF(TRIM(COALESCE(pd.lot_number, '')), ''),
              NULLIF(TRIM(COALESCE(pd.street, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line1, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line2, '')), ''),
              NULLIF(TRIM(COALESCE(pd.city, '')), ''),
              NULLIF(TRIM(COALESCE(st.name, '')), ''),
              NULLIF(TRIM(COALESCE(pd.zip_code, '')), '')
            )
          ), ''),
          'N/A'
        )
      ) LIKE LOWER(:jobAddress)`);
      replacements.jobAddress = `%${job_address}%`;
    }
    if (site_supervisor_id) {
      conditions.push("t.site_supervisor_id = :siteSupervisorId");
      replacements.siteSupervisorId = site_supervisor_id;
    }
    if (supplier_id) {
      const supplierIds = (Array.isArray(supplier_id) ? supplier_id : [supplier_id])
        .flatMap((value) => String(value).split(","))
        .map((id) => id.trim())
        .filter(Boolean);
      if (supplierIds.length > 0) {
        conditions.push("t.supplier_id IN (:supplierIds)");
        replacements.supplierIds = supplierIds;
      }
    }
    if (booking_date_from) {
      conditions.push("t.booking_date >= :bookingDateFrom");
      replacements.bookingDateFrom = booking_date_from;
    }
    if (booking_date_to) {
      conditions.push("t.booking_date <= :bookingDateTo");
      replacements.bookingDateTo = booking_date_to;
    }
    if (start_date_from) {
      conditions.push("t.start_date >= :startDateFrom");
      replacements.startDateFrom = start_date_from;
    }
    if (start_date_to) {
      conditions.push("t.start_date <= :startDateTo");
      replacements.startDateTo = start_date_to;
    }
    if (status) {
      conditions.push("t.status = :status");
      replacements.status = status;
    }

    if (date_filter) {
      switch (date_filter) {
        case "today":
          conditions.push("t.booking_date = CURRENT_DATE");
          conditions.push("t.status <> 'Cancelled'");
          break;
        case "tomorrow":
          conditions.push("t.booking_date = CURRENT_DATE + INTERVAL '1 day'");
          conditions.push("t.status <> 'Cancelled'");
          break;
        case "this_week":
          conditions.push("t.booking_date BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'");
          conditions.push("t.status <> 'Cancelled'");
          break;
        case "next_week":
          conditions.push("t.booking_date BETWEEN date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days'");
          conditions.push("t.status <> 'Cancelled'");
          break;
        case "overdue":
          conditions.push("t.booking_date < CURRENT_DATE");
          conditions.push("t.status <> 'Cancelled'");
          break;
      }
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const { sequelize } = db;

    const counterRows = await sequelize.query(
      `SELECT
        COUNT(*) AS all_count,
        COUNT(*) FILTER (WHERE t.booking_date = CURRENT_DATE AND t.status <> 'Cancelled') AS today_count,
        COUNT(*) FILTER (WHERE t.booking_date = CURRENT_DATE + INTERVAL '1 day' AND t.status <> 'Cancelled') AS tomorrow_count,
        COUNT(*) FILTER (WHERE t.booking_date BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days' AND t.status <> 'Cancelled') AS this_week_count,
        COUNT(*) FILTER (WHERE t.booking_date BETWEEN date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days' AND t.status <> 'Cancelled') AS next_week_count,
        COUNT(*) FILTER (WHERE t.booking_date < CURRENT_DATE AND t.status <> 'Cancelled') AS overdue_count
       FROM todo t
       WHERE t.builder_id = :builderId`,
      { type: QueryTypes.SELECT, replacements: { builderId } }
    );

    const counters = {
      allCount: Number(counterRows[0]?.all_count) || 0,
      todayCount: Number(counterRows[0]?.today_count) || 0,
      tomorrowCount: Number(counterRows[0]?.tomorrow_count) || 0,
      thisWeekCount: Number(counterRows[0]?.this_week_count) || 0,
      nextWeekCount: Number(counterRows[0]?.next_week_count) || 0,
      overdueCount: Number(counterRows[0]?.overdue_count) || 0,
    };

    const countRows = await sequelize.query(
      `SELECT COUNT(*) AS total
       FROM todo t
       LEFT JOIN job j ON t.job_id = j.job_id
       LEFT JOIN opportunity o ON j.opportunity_id = o.opportunity_id
       LEFT JOIN leads l ON o.leads_id = l.leads_id
       LEFT JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
       LEFT JOIN state st ON pd.state_id = st.state_id
       ${whereClause}`,
      { type: QueryTypes.SELECT, replacements }
    );
    const totalRecords = parseInt(countRows[0]?.total, 10) || 0;
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataRows = await sequelize.query(
      `SELECT
        t.todo_id,
        t.task_name,
        t.booking_date,
        t.start_date,
        t.finish_date,
        t.subject,
        t.message,
        t.status,
        t.supplier_id,
        t.site_supervisor_id,
        t.job_id,
        t.created_at,
        t.updated_at,
        COALESCE(
          NULLIF(TRIM(
            CONCAT_WS(', ',
              NULLIF(TRIM(COALESCE(pd.lot_number, '')), ''),
              NULLIF(TRIM(COALESCE(pd.street, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line1, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line2, '')), ''),
              NULLIF(TRIM(COALESCE(pd.city, '')), ''),
              NULLIF(TRIM(COALESCE(st.name, '')), ''),
              NULLIF(TRIM(COALESCE(pd.zip_code, '')), '')
            )
          ), ''),
          'N/A'
        ) AS job_address,
        u.name AS site_supervisor,
        s.company_name AS supplier_name
       FROM todo t
       LEFT JOIN job j ON t.job_id = j.job_id
       LEFT JOIN opportunity o ON j.opportunity_id = o.opportunity_id
       LEFT JOIN leads l ON o.leads_id = l.leads_id
       LEFT JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
       LEFT JOIN state st ON pd.state_id = st.state_id
       LEFT JOIN users u ON t.site_supervisor_id = u.users_id
       LEFT JOIN supplier s ON t.supplier_id = s.supplier_id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ${limitValue} OFFSET ${offset}`,
      { type: QueryTypes.SELECT, replacements }
    );

    const todos = keysToCamelCase(dataRows);

    return successResponse(
      res,
      { todos, pagination: { currentPage: pageValue, totalPages, totalRecords, limit: limitValue }, counters },
      "Todos fetched successfully"
    );
  } catch (err) {
    console.error("Error fetching todos:", err);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function getTodoById(req, res) {
  try {
    const { todo_id } = req.params;
    const builderId = req.user?.builder_id;
    const { sequelize } = db;

    const rows = await sequelize.query(
      `SELECT
        t.*,
        COALESCE(
          NULLIF(TRIM(
            CONCAT_WS(', ',
              NULLIF(TRIM(COALESCE(pd.lot_number, '')), ''),
              NULLIF(TRIM(COALESCE(pd.street, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line1, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line2, '')), ''),
              NULLIF(TRIM(COALESCE(pd.city, '')), ''),
              NULLIF(TRIM(COALESCE(st.name, '')), ''),
              NULLIF(TRIM(COALESCE(pd.zip_code, '')), '')
            )
          ), ''),
          'N/A'
        ) AS job_address,
        u.name AS site_supervisor,
        s.company_name AS supplier_name
       FROM todo t
       LEFT JOIN job j ON t.job_id = j.job_id
       LEFT JOIN opportunity o ON j.opportunity_id = o.opportunity_id
       LEFT JOIN leads l ON o.leads_id = l.leads_id
       LEFT JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
       LEFT JOIN state st ON pd.state_id = st.state_id
       LEFT JOIN users u ON t.site_supervisor_id = u.users_id
       LEFT JOIN supplier s ON t.supplier_id = s.supplier_id
       WHERE t.todo_id = :todoId AND t.builder_id = :builderId`,
      { type: QueryTypes.SELECT, replacements: { todoId: todo_id, builderId } }
    );

    if (rows.length === 0) {
      return errorResponse(res, 404, "Todo not found");
    }

    return successResponse(res, keysToCamelCase(rows[0]), "Todo fetched successfully");
  } catch (err) {
    console.error("Error fetching todo:", err);
    return errorResponse(res, 500, "Internal server error");
  }
}

export async function updateTodo(req, res) {
  try {
    const { todo_id } = req.params;
    const builderId = req.user?.builder_id;
    const updatedBy = req.user?.user_id;

    const todo = await db.Todo.findOne({ where: { todo_id, builder_id: builderId } });
    if (!todo) {
      return errorResponse(res, 404, "Todo not found");
    }

    const {
      job_id,
      task_name,
      supplier_id,
      booking_date,
      start_date,
      finish_date,
      site_supervisor_id,
      subject,
      message,
      status,
    } = req.body;

    const updateData = { updated_by: updatedBy };
    if (job_id !== undefined) updateData.job_id = job_id || null;
    if (task_name !== undefined) updateData.task_name = task_name;
    if (supplier_id !== undefined) {
      if (!supplier_id) {
        return errorResponse(res, 400, "supplier_id cannot be empty");
      }
      const supplier = await db.Supplier.findOne({
        where: { supplier_id, builder_id: builderId, company_id: req.user?.company_id, status: true },
        attributes: ["supplier_id"],
      });
      if (!supplier) {
        return errorResponse(res, 400, "Invalid supplier_id");
      }
      updateData.supplier_id = supplier_id;
      // To-do assignment is supplier-only.
      updateData.site_supervisor_id = null;
    }
    if (booking_date !== undefined) updateData.booking_date = booking_date || null;
    if (start_date !== undefined) updateData.start_date = start_date || null;
    if (finish_date !== undefined) updateData.finish_date = finish_date || null;
    if (site_supervisor_id !== undefined && supplier_id === undefined) {
      updateData.site_supervisor_id = null;
    }
    if (subject !== undefined) updateData.subject = subject || null;
    if (message !== undefined) updateData.message = message || null;
    if (status !== undefined) updateData.status = status;

    await todo.update(updateData);

    return successResponse(res, keysToCamelCase(todo.toJSON()), "Todo updated successfully");
  } catch (err) {
    console.error("Error updating todo:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  }
}

export async function deleteTodo(req, res) {
  try {
    const { todo_id } = req.params;
    const builderId = req.user?.builder_id;

    const deleted = await db.Todo.destroy({ where: { todo_id, builder_id: builderId } });
    if (!deleted) {
      return errorResponse(res, 404, "Todo not found");
    }

    return successResponse(res, {}, "Todo deleted successfully");
  } catch (err) {
    console.error("Error deleting todo:", err);
    return errorResponse(res, 500, "Internal server error");
  }
}
