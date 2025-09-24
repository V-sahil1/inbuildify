const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllWorkFlowProcess = async (req, res) => {
  const { limit, offset } = req.query;
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM workflow_process WHERE builder_id = $1 AND is_deleted = false
      ORDER BY display_order ASC LIMIT $2 OFFSET $3`,
      [req.user.builder_id, parsedLimit, parsedOffset]
    );

    const totalResult = await client.query(
      `SELECT COUNT(*) FROM workflow_process WHERE builder_id = $1 AND is_deleted = false`,
      [req.user.builder_id]
    );

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        workflowProcesses: keysToCamelCase(result.rows),
        pagination: {
          totalItems,
          totalPages,
          currentPage,
          limit: parsedLimit,
        },
      },
      "Workflow processes fetched successfully."
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Failed to fetch workflow processes."
    );
  } finally {
    client.release();
  }
};

exports.createWorkFlowProcess = async (req, res) => {
  const { name, description } = req.body;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkNameExists = await client.query(
      `SELECT * FROM workflow_process WHERE name = $1 AND builder_id = $2 AND is_deleted = false`,
      [name, builderId]
    );
    if (checkNameExists.rowCount > 0) {
      return errorResponse(res, 400, "Workflow process name already exists.");
    }

    const orderResult = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order 
       FROM workflow_process WHERE builder_id = $1`,
      [builderId]
    );
    const displayOrder = orderResult.rows[0].next_order;

    const result = await client.query(
      `
      INSERT INTO workflow_process (builder_id, name, description, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [builderId, name, description || null, displayOrder]
    );

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Workflow process created successfully."
    );
  } catch (error) {
    console.error("Create workflow process error:", error);
    return errorResponse(res, 500, "Failed to create workflow process.");
  } finally {
    client.release();
  }
};

exports.updateWorkFlowProcess = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      UPDATE workflow_process
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE workflow_process_id = $3 AND builder_id = $4 AND is_deleted = false
      RETURNING *
      `,
      [name || null, description || null, id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Workflow process not found or already deleted."
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Workflow process updated successfully."
    );
  } catch (error) {
    console.error("Update workflow process error:", error);
    return errorResponse(res, 500, "Failed to update workflow process.");
  } finally {
    client.release();
  }
};

exports.displayOrderManage = async (req, res) => {
  const { orderedWorkflowProcess } = req.body;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const workflowProcessIds = orderedWorkflowProcess.map(
      (c) => c.workflowProcessId
    );

    const { rows: existingWorkflowProcesses } = await client.query(
      `
      SELECT workflow_process_id
      FROM workflow_process
      WHERE builder_id = $1
        AND is_deleted = false
        AND workflow_process_id = ANY($2::uuid[])
      `,
      [builderId, workflowProcessIds]
    );

    const validIds = existingWorkflowProcesses.map(
      (c) => c.workflow_process_id
    );
    const invalidIds = workflowProcessIds.filter(
      (id) => !validIds.includes(id)
    );

    if (invalidIds.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid or deleted workflow processes: ${invalidIds.join(", ")}`
      );
    }

    const cases = [];
    const values = [builderId];
    let i = 2;
    for (const { workflowProcessId, displayOrder } of orderedWorkflowProcess) {
      cases.push(`WHEN workflow_process_id = $${i} THEN $${i + 1}::int`);
      values.push(workflowProcessId, Number(displayOrder));
      i += 2;
    }

    const query = `
      UPDATE workflow_process
      SET display_order = CASE ${cases.join(" ")} END,
          updated_at = NOW()
      WHERE builder_id = $1
        AND workflow_process_id = ANY($${i}::uuid[])
      RETURNING *
    `;
    values.push(workflowProcessIds);

    const { rows: updatedRows } = await client.query(query, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      "", // keysToCamelCase(updatedRows),
      "Workflow process display orders updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Display order manage error:", error);
    return errorResponse(
      res,
      res.statusCode || 400,
      error?.message || "Failed to manage workflow process display orders."
    );
  } finally {
    client.release();
  }
};

exports.deleteWorkFlowProcess = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkWorkflowProcessExists = await client.query(
      `SELECT * FROM workflow_process WHERE workflow_process_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [id, builderId]
    );

    if (checkWorkflowProcessExists.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Workflow process not found or already deleted."
      );
    }

    const result = await client.query(
      `
      UPDATE workflow_process
      SET is_deleted = true
      WHERE workflow_process_id = $1 AND builder_id = $2
      RETURNING *
      `,
      [id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Workflow process not found or already deleted."
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Workflow process deleted successfully."
    );
  } catch (error) {
    console.error("Delete workflow process error:", error);
    return errorResponse(res, 500, "Failed to delete workflow process.");
  } finally {
    client.release();
  }
};

exports.getWorkflowProcessesByCategoryId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { workflow_process_id } = req.params;
    const builderId = req.user.builder_id;

    // First verify the workflow_process exists and belongs to the builder
    const workflowProcessCheck = await client.query(
      `SELECT * FROM workflow_process WHERE workflow_process_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [workflow_process_id, builderId]
    );

    if (workflowProcessCheck.rowCount === 0) {
      return errorResponse(res, 404, "Workflow process not found.");
    }

    const query = `
      SELECT 
        wpt.workflow_process_task_id,
        wpt.workflow_process_id,
        wpt.name,
        wpt.description,
        wpt.attachment,
        wpt.timespent,
        wpt.is_deleted,
        wpt.created_at,
        wpt.updated_at
      FROM workflow_process_task wpt
      WHERE wpt.workflow_process_id = $1 AND wpt.is_deleted = false
      ORDER BY wpt.created_at DESC;
    `;

    const result = await client.query(query, [workflow_process_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Workflow process tasks fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching workflow process tasks:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.createWorkflowProcessTask = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { workflow_process_id, name, description, timespent } = req.body;

    await client.query(`BEGIN`);

    const imageUrl = req.file?.location;

    // Verify workflow_process exists and belongs to builder
    const workflowProcessCheck = await client.query(
      `SELECT 1 FROM workflow_process WHERE workflow_process_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [workflow_process_id, builderId]
    );

    if (workflowProcessCheck.rows.length === 0) {
      await client.query(`ROLLBACK`);
      return errorResponse(res, 404, "Workflow process not found.");
    }

    // Check if task name already exists for this workflow process
    const nameCheck = await client.query(
      `SELECT * FROM workflow_process_task WHERE workflow_process_id = $1 AND name = $2 AND is_deleted = false`,
      [workflow_process_id, name]
    );

    if (nameCheck.rowCount > 0) {
      await client.query(`ROLLBACK`);
      return errorResponse(
        res,
        400,
        "Task name already exists in this workflow process."
      );
    }

    const taskQuery = `
    INSERT INTO workflow_process_task (
        workflow_process_id, name, description, attachment, timespent
    ) VALUES (
        $1, $2, $3, $4, $5
    )
    RETURNING *;
    `;

    const taskValues = [
      workflow_process_id,
      name,
      description || null,
      imageUrl || null,
      timespent || null,
    ];

    const taskResult = await client.query(taskQuery, taskValues);

    await client.query(`COMMIT`);

    return successResponse(
      res,
      keysToCamelCase(taskResult.rows[0]),
      "Workflow process task created successfully."
    );
  } catch (err) {
    await client.query(`ROLLBACK`);
    console.error("Error creating workflow process task:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.updateWorkflowProcessTask = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { workflow_process_task_id } = req.params;
    const imageUrl = req.file?.location;

    // Prevent updating workflow_process_id
    if ("workflow_process_id" in req.body) {
      return errorResponse(
        res,
        400,
        "Updating workflow_process_id is not allowed."
      );
    }

    const { name, description, image, timespent } = req.body;

    await client.query("BEGIN");

    // Verify task exists and get workflow_process_id for builder verification
    const taskRes = await client.query(
      `
    SELECT wpt.*, wp.builder_id 
    FROM workflow_process_task wpt
    JOIN workflow_process wp ON wpt.workflow_process_id = wp.workflow_process_id
    WHERE wpt.workflow_process_task_id = $1 AND wp.builder_id = $2 AND wpt.is_deleted = false`,
      [workflow_process_task_id, builderId]
    );

    if (taskRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Workflow process task not found.");
    }

    // Check for duplicate name if name is being updated
    if (name && name !== taskRes.rows[0].name) {
      const nameCheck = await client.query(
        `SELECT * FROM workflow_process_task 
        WHERE workflow_process_id = $1 AND name = $2 AND workflow_process_task_id != $3 AND is_deleted = false`,
        [taskRes.rows[0].workflow_process_id, name, workflow_process_task_id]
      );

      if (nameCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Task name already exists in this workflow process."
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    const addField = (column, value) => {
      if (value !== undefined) {
        updateFields.push(`${column} = $${idx++}`);
        updateValues.push(value);
      }
    };

    addField("name", name);
    addField("description", description);
    addField("attachment", imageUrl || taskRes.rows[0].attachment);
    addField("timespent", timespent);
    addField("updated_at", new Date());

    let updatedTask = null;
    if (updateFields.length > 0) {
      const updateQuery = `
        UPDATE workflow_process_task
        SET ${updateFields.join(", ")}
        WHERE workflow_process_task_id = $${idx++}
        RETURNING *;
    `;
      updateValues.push(workflow_process_task_id);

      const updatedRes = await client.query(updateQuery, updateValues);
      updatedTask = updatedRes.rows[0];
    } else {
      // If no fields to update, just fetch existing
      const fetchRes = await client.query(
        `SELECT * FROM workflow_process_task WHERE workflow_process_task_id = $1`,
        [workflow_process_task_id]
      );
      updatedTask = fetchRes.rows[0];
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updatedTask),
      "Workflow process task updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating workflow process task:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.deleteWorkflowProcessTask = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { workflow_process_task_id } = req.params;

    await client.query("BEGIN");

    // Verify task exists and belongs to builder's workflow process
    const taskRes = await client.query(
      `
    SELECT wpt.* 
    FROM workflow_process_task wpt
    JOIN workflow_process wp ON wpt.workflow_process_id = wp.workflow_process_id
    WHERE wpt.workflow_process_task_id = $1 AND wp.builder_id = $2 AND wpt.is_deleted = false`,
      [workflow_process_task_id, builderId]
    );

    if (taskRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Workflow process task not found.");
    }

    const task = taskRes.rows[0];

    // Soft delete the task
    await client.query(
      `UPDATE workflow_process_task SET is_deleted = true, updated_at = NOW() WHERE workflow_process_task_id = $1`,
      [workflow_process_task_id]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(task),
      "Workflow process task deleted successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting workflow process task:", err);
    return errorResponse(
      res,
      err?.statusCode || 400,
      err.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};
