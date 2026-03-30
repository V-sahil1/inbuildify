import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

// Allowed fields per action_type
const ALLOWED_FIELDS = {
  note: [
    "description",
    "notes_tag_id",
    "send_to_customer",
    "create_follow_up_task",
    "attach_file",
  ],
  sms: ["users_id", "description"],
  appointment: [
    "name",
    "due_date",
    "end_date",
    "location_id",
    "start_time",
    "end_time",
    "users_id",
    "description",
    "send_to_customer",
  ],
  task: [
    "name",
    "due_date",
    "end_time",
    "users_id",
    "priority",
    "status",
    "link_to_user",
    "description",
    "attach_file",
  ],
};

// Validate that the body only contains allowed fields for the given action_type
function getInvalidFields(body, actionType) {
  const allowed = new Set([
    ...(ALLOWED_FIELDS[actionType] || []),
    "action_type",
  ]);
  return Object.keys(body).filter((key) => !allowed.has(key));
}

// Filter body to only include allowed fields for the given action_type
function filterBodyByType(body, actionType) {
  const allowed = ALLOWED_FIELDS[actionType] || [];
  const filtered = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      filtered[key] = body[key];
    }
  }
  return filtered;
}

export async function createAction(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { action_type } = req.body;

    if (!builderId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    // Verify lead exists and belongs to the builder/company
    const leadCheck = await client.query(
      "SELECT leads_id FROM leads WHERE leads_id = $1 AND (builder_id = $2 OR (company_id = $3 AND $3 IS NOT NULL))",
      [leads_id, builderId, companyId],
    );

    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead not found");
    }

    // Strict field validation
    const invalidFields = getInvalidFields(req.body, action_type);
    if (invalidFields.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, `Fields are not allowed for action type ${action_type}: ${invalidFields.join(", ")}`);
    }

    if (action_type === "sms" && (!req.body.users_id || req.body.users_id.length === 0)) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "users_id is required for SMS action type");
    }

    // Filter body to only allowed fields for this action_type
    const filteredBody = filterBodyByType(req.body, action_type);

    // Handle file upload
    const attachFile = req.files?.attachFile?.[0]?.location || null;
    if (
      attachFile &&
      ALLOWED_FIELDS[action_type]?.includes("attach_file")
    ) {
      filteredBody.attach_file = attachFile;
    }

    // Validate users_id entries exist
    if (filteredBody.users_id && filteredBody.users_id.length > 0) {
      const usersCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND builder_id = $2 AND is_active = true AND is_deleted = false",
        [filteredBody.users_id, builderId],
      );
      const foundIds = usersCheck.rows.map((r) => r.users_id);
      const missing = filteredBody.users_id.filter(
        (id) => !foundIds.includes(id),
      );
      if (missing.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid users_id: ${missing.join(", ")}`,
        );
      }
    }

    // Validate link_to_user exists
    if (filteredBody.link_to_user) {
      const linkCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND builder_id = $2 AND is_active = true AND is_deleted = false",
        [filteredBody.link_to_user, builderId],
      );
      if (linkCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid link_to_user: User not found");
      }
    }

    // Validate location_id exists
    if (filteredBody.location_id) {
      const locationCheck = await client.query(
        "SELECT location_id FROM location WHERE location_id = $1",
        [filteredBody.location_id],
      );
      if (locationCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid location_id: Location not found");
      }
    }

    // Build INSERT query dynamically
    const columns = ["leads_id", "action_type"];
    const placeholders = ["$1", "$2"];
    const values = [leads_id, action_type];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(filteredBody)) {
      columns.push(key);
      placeholders.push(`$${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    const insertQuery = `
      INSERT INTO actions (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `;

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Action created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create action error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function getActions(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { action_type, page = 1, limit = 25 } = req.query;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    // Verify lead ownership
    const leadCheck = await client.query(
      "SELECT leads_id FROM leads WHERE leads_id = $1 AND (builder_id = $2 OR (company_id = $3 AND $3 IS NOT NULL))",
      [leads_id, builderId, companyId],
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found");
    }

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const filters = ["a.leads_id = $1"];
    const values = [leads_id];
    let paramIndex = 2;

    if (action_type) {
      filters.push(`a.action_type = $${paramIndex}`);
      values.push(action_type);
      paramIndex++;
    }

    const whereClause = filters.join(" AND ");

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM actions a WHERE ${whereClause}`;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitValue);

    // Data query
    const dataQuery = `
      SELECT a.*,
        loc.name as location_name,
        link_user.name as link_to_user_name
      FROM actions a
      LEFT JOIN location loc ON a.location_id = loc.location_id
      LEFT JOIN users link_user ON a.link_to_user = link_user.users_id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limitValue, offset);
    const dataResult = await client.query(dataQuery, values);

    // Resolve users_id names for each action
    const actions = [];
    for (const row of dataResult.rows) {
      const action = keysToCamelCase(row);

      if (row.users_id && row.users_id.length > 0) {
        const usersResult = await client.query(
          "SELECT users_id, name FROM users WHERE users_id = ANY($1::uuid[])",
          [row.users_id],
        );
        action.users = usersResult.rows.map((u) => ({
          usersId: u.users_id,
          name: u.name,
        }));
      } else {
        action.users = [];
      }

      actions.push(action);
    }

    return successResponse(
      res,
      {
        actions,
        pagination: {
          page: pageValue,
          limit: limitValue,
          total,
          totalPages,
        },
      },
      "Actions fetched successfully",
    );
  } catch (error) {
    console.error("Get actions error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateAction(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { action_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    // Fetch existing action and verify ownership
    const findQuery = `
      SELECT a.*
      FROM actions a
      JOIN leads l ON a.leads_id = l.leads_id
      WHERE a.action_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
    `;
    const findResult = await client.query(findQuery, [
      action_id,
      builderId,
      companyId,
    ]);

    if (findResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Action not found or you do not have permission to update it",
      );
    }

    const existingAction = findResult.rows[0];
    const actionType = existingAction.action_type;

    // Strict field validation for update
    const invalidFields = getInvalidFields(req.body, actionType);
    if (invalidFields.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, `Fields are not allowed for updating action type ${actionType}: ${invalidFields.join(", ")}`);
    }

    // Filter body to only allowed fields for this action_type
    const filteredBody = filterBodyByType(req.body, actionType);

    // Handle file upload
    const newAttachFile = req.files?.attachFile?.[0]?.location || null;

    if (ALLOWED_FIELDS[actionType]?.includes("attach_file")) {
      if (newAttachFile) {
        // New file uploaded — delete old if exists
        if (
          existingAction.attach_file &&
          existingAction.attach_file !== newAttachFile
        ) {
          try {
            await deleteFromS3(existingAction.attach_file);
          } catch (s3Error) {
            console.error("Error deleting old attachment from S3:", s3Error);
          }
        }
        filteredBody.attach_file = newAttachFile;
      } else if (
        filteredBody.attach_file === "" ||
        filteredBody.attach_file === null
      ) {
        // User explicitly wants to clear the file
        if (existingAction.attach_file) {
          try {
            await deleteFromS3(existingAction.attach_file);
          } catch (s3Error) {
            console.error("Error deleting old attachment from S3:", s3Error);
          }
        }
        filteredBody.attach_file = null;
      }
    }

    // Validate users_id entries exist
    if (filteredBody.users_id && filteredBody.users_id.length > 0) {
      const usersCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND builder_id = $2 AND is_active = true AND is_deleted = false",
        [filteredBody.users_id, builderId],
      );
      const foundIds = usersCheck.rows.map((r) => r.users_id);
      const missing = filteredBody.users_id.filter(
        (id) => !foundIds.includes(id),
      );
      if (missing.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid users_id: ${missing.join(", ")}`,
        );
      }
    }

    // Validate link_to_user exists
    if (filteredBody.link_to_user) {
      const linkCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND builder_id = $2 AND is_active = true AND is_deleted = false",
        [filteredBody.link_to_user, builderId],
      );
      if (linkCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid link_to_user: User not found");
      }
    }

    // Validate location_id exists
    if (filteredBody.location_id) {
      const locationCheck = await client.query(
        "SELECT location_id FROM location WHERE location_id = $1",
        [filteredBody.location_id],
      );
      if (locationCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid location_id: Location not found");
      }
    }

    // Build UPDATE query dynamically
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filteredBody)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields to update");
    }

    fields.push("updated_at = NOW()");
    values.push(action_id);

    const updateQuery = `
      UPDATE actions
      SET ${fields.join(", ")}
      WHERE action_id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Action updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update action error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function deleteAction(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { action_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Unauthorized: Builder ID missing");
    }

    // Fetch existing action and verify ownership
    const findQuery = `
      SELECT a.*
      FROM actions a
      JOIN leads l ON a.leads_id = l.leads_id
      WHERE a.action_id = $1 AND (l.builder_id = $2 OR (l.company_id = $3 AND $3 IS NOT NULL))
    `;
    const findResult = await client.query(findQuery, [
      action_id,
      builderId,
      companyId,
    ]);

    if (findResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Action not found or you do not have permission to delete it",
      );
    }

    const existingAction = findResult.rows[0];

    // Delete attach_file from S3 if exists
    if (existingAction.attach_file) {
      try {
        await deleteFromS3(existingAction.attach_file);
      } catch (s3Error) {
        console.error("Error deleting attachment from S3:", s3Error);
      }
    }

    await client.query("DELETE FROM actions WHERE action_id = $1", [action_id]);
    await client.query("COMMIT");

    return successResponse(res, null, "Action deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete action error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export default {
  createAction,
  getActions,
  updateAction,
  deleteAction,
};
