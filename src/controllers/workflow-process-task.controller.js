const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllWorkFlowProcessTask = async (req, res) => {
  try {
    const { limit, offset, workflow_process_id, lead_id } = req.query;
    const builderId = req.user.builder_id;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const actionsRes = await client.query(
        `SELECT action_id FROM actions WHERE builder_id = $1 AND lead_id = $2 AND type = 'TASK'`,
        [builderId, lead_id]
      );

      if (actionsRes.rowCount === 0) {
        return successResponse(
          res,
          [],
          "Workflow process tasks fetched successfully."
        );
      }

      const actionIds = actionsRes.rows.map((r) => r.action_id);

      const tasksQuery = `
        SELECT t.*,
              jsonb_build_object(
                'id', u.users_id,
                'name', u.name
              ) AS assignee
          FROM task t
          LEFT JOIN users u ON t.assignee = u.users_id
         WHERE action_id = ANY($1::uuid[])
           AND t.is_deleted = false
           AND t.is_workflow_process_task = true
           AND t.workflow_process_id = $2
         ORDER BY t.created_at DESC
         LIMIT $3 OFFSET $4
      `;
      const tasksValues = [actionIds, workflow_process_id, limit, offset];
      const tasksRes = await client.query(tasksQuery, tasksValues);
      const data = keysToCamelCase(tasksRes.rows);
      return successResponse(
        res,
        data,
        "Workflow process tasks fetched successfully."
      );
    } catch (error) {
      return errorResponse(res, error.statusCode || 400, error.message);
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(res, error.statusCode || 400, error.message);
  }
};

exports.deleteWorkFlowProcessTask = async (req, res) => {
  try {
    const { action_id } = req.params;
    const builderId = req.user.builder_id;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const actionsRes = await client.query(
        `SELECT t.* FROM task t INNER JOIN actions a ON t.action_id = a.action_id WHERE a.builder_id = $1 AND a.action_id = $2 AND t.is_workflow_process_task = true AND a.type = 'TASK' AND t.is_deleted = false`,
        [builderId, action_id]
      );
      if (actionsRes.rowCount === 0) {
        return successResponse(
          res,
          [],
          "Workflow process task not found."
        );
      }
      const taskRes = await client.query(
        `UPDATE task SET is_deleted = true WHERE action_id = $1 AND is_workflow_process_task = true AND is_deleted = false RETURNING *`,
        [action_id]
      );
      if (taskRes.rowCount === 0) {
        return successResponse(
          res,
          [],
          "Workflow process task not found."
        );
      }
      return successResponse(
        res,
        keysToCamelCase(taskRes.rows),
        "Workflow process task deleted successfully."
      );
    } catch (error) {
      return errorResponse(res, error.statusCode || 400, error.message);
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(res, error.statusCode || 400, error.message);
  }
};
