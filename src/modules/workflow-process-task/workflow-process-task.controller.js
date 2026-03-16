import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

const getUsersDetails = async (client, userIds) => {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  const validUserIds = userIds.filter(Boolean);
  if (validUserIds.length === 0) {
    return {};
  }

  const usersQuery = `
    SELECT users_id, name 
    FROM users 
    WHERE users_id = ANY($1::uuid[])
  `;
  const usersResult = await client.query(usersQuery, [validUserIds]);

  return usersResult.rows.reduce((acc, row) => {
    acc[row.users_id] = row.name;
    return acc;
  }, {});
};

const formatUserObject = (userId, usersMap) => {
  if (!userId) {
    return null;
  }
  return {
    id: userId,
    name: usersMap[userId] || null,
  };
};

export async function getAllWorkFlowProcessTask(req, res) {
  try {
    const { limit, offset, workflow_process_id, lead_id } = req.query;
    const parsedLimit = parseInt(limit, 10) || 25;
    const parsedOffset = parseInt(offset, 10) || 0;
    const builderId = req.user.builder_id;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const actionsRes = await client.query(
        "SELECT action_id FROM actions WHERE builder_id = $1 AND lead_id = $2 AND type = 'TASK'",
        [builderId, lead_id],
      );

      if (actionsRes.rowCount === 0) {
        return successResponse(
          res,
          [],
          "Workflow process tasks fetched successfully.",
        );
      }

      const actionIds = actionsRes.rows.map((r) => r.action_id);

      const tasksQuery = `
        SELECT t.*
          FROM task t
         WHERE action_id = ANY($1::uuid[])
           AND t.is_deleted = false
           AND t.is_workflow_process_task = true
           AND t.workflow_process_id = $2
         ORDER BY t.created_at DESC
         LIMIT $3 OFFSET $4
      `;
      const tasksValues = [actionIds, workflow_process_id, parsedLimit, parsedOffset];
      const tasksRes = await client.query(tasksQuery, tasksValues);
      const tasks = keysToCamelCase(tasksRes.rows);

      const allUserIds = [
        ...new Set([
          ...tasks.map((t) => t.assignee),
          ...tasks.map((t) => t.createdById),
          ...tasks.map((t) => t.updatedById),
        ]),
      ].filter(Boolean);

      const usersMap = await getUsersDetails(client, allUserIds);

      const tasksWithUsers = tasks.map((task) => ({
        ...task,
        assignee: formatUserObject(task.assignee, usersMap),
        createdBy: formatUserObject(task.createdById, usersMap),
        updatedBy: formatUserObject(task.updatedById, usersMap),
      }));

      return successResponse(
        res,
        tasksWithUsers,
        "Workflow process tasks fetched successfully.",
      );
    } catch (error) {
      console.error("Get all workflow process task error:", error);
      return errorResponse(res, error.statusCode || 400, error.message);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Get all workflow process task outer error:", error);
    return errorResponse(res, error.statusCode || 400, error.message);
  }
}

export async function deleteWorkFlowProcessTask(req, res) {
  try {
    const { action_id } = req.params;
    const builderId = req.user.builder_id;
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const actionsRes = await client.query(
        `SELECT t.* FROM task t 
         INNER JOIN actions a ON t.action_id = a.action_id 
         WHERE a.builder_id = $1 
           AND a.action_id = $2 
           AND t.is_workflow_process_task = true 
           AND a.type = 'TASK' 
           AND t.is_deleted = false`,
        [builderId, action_id],
      );

      if (actionsRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          404,
          "Workflow process task not found.",
        );
      }
      const taskRes = await client.query(
        `UPDATE task 
         SET is_deleted = true,
             updated_at = NOW() 
         WHERE action_id = $1 
           AND is_workflow_process_task = true 
           AND is_deleted = false 
         RETURNING *`,
        [action_id],
      );

      if (taskRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          404,
          "Workflow process task not found.",
        );
      }

      const task = keysToCamelCase(taskRes.rows[0]);

      const allUserIds = [
        task.assignee,
        task.createdById,
        task.updatedById,
      ].filter(Boolean);

      const usersMap = await getUsersDetails(client, allUserIds);

      const taskWithUsers = {
        ...task,
        assignee: formatUserObject(task.assignee, usersMap),
        createdBy: formatUserObject(task.createdById, usersMap),
        updatedBy: formatUserObject(task.updatedById, usersMap),
      };

      await client.query("COMMIT");

      return successResponse(
        res,
        taskWithUsers,
        "Workflow process task deleted successfully.",
      );
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Delete workflow process task error:", error);
      return errorResponse(res, error.statusCode || 400, error.message);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Delete workflow process task outer error:", error);
    return errorResponse(res, error.statusCode || 400, error.message);
  }
}
