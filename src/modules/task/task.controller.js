import { successResponse, errorResponse } from "../../helper/response.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";
import {
  createTaskService,
  getAllTasksService,
  deleteTaskService,
  updateTaskService,
} from "./task.service.js";

/**
 * Controller: Create Task
 */
export async function createTask(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 400, "Invalid builder or company");
    }

    const {
      name,
      description,
      due_date,
      due_time,
      assignee_id,
      link_to,
      link_type,
      lead_id,
      priority,
      status,
    } = req.body;

    const attach_files = req.files?.attachFiles?.[0]?.location || null;

    if (lead_id) {
      await checkLeadLockStatus(lead_id);
    }

    const result = await createTaskService({
      builderId,
      companyId,
      createdBy: userId,
      name,
      description,
      due_date,
      due_time,
      assignee_id,
      link_to,
      link_type,
      lead_id,
      priority,
      status,
      attach_files,
    });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, result.data, "Task created successfully.");
  } catch (err) {
    console.error("Error creating task:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  }
}

/**
 * Controller: Get All Tasks
 */
export async function getAllTasks(req, res) {
  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID missing from token");
    }

    const {
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
    } = req.query;

    const result = await getAllTasksService({
      builderId,
      page,
      limit,
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
      sort_by,
      sort_order,
    });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, result.data, "Tasks fetched successfully");
  } catch (error) {
    console.error("Error in getAllTasks:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

/**
 * Controller: Delete Task
 */
export async function deleteTask(req, res) {
  try {
    const { task_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!task_id) {
      return errorResponse(res, 400, "task_id is required");
    }

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID missing from token");
    }

    const result = await deleteTaskService({ task_id, builderId });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, result.data, "Task deleted successfully");
  } catch (error) {
    console.error("Error deleting task:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

/**
 * Controller: Update Task
 */
export async function updateTask(req, res) {
  try {
    const { task_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.users_id;

    if (!task_id) {
      return errorResponse(res, 400, "task_id is required");
    }

    const {
      name,
      description,
      due_date,
      due_time,
      assignee_id,
      link_to,
      link_type,
      priority,
      status,
      attach_files,
    } = req.body;

    const uploadedFile = req.files?.attachFiles?.[0]?.location;
    const newAttachFiles = uploadedFile || (attach_files || undefined);
    const clearAttachment = !uploadedFile && (attach_files === "" || attach_files === null);

    const result = await updateTaskService({
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
      newAttachFiles: clearAttachment ? undefined : newAttachFiles,
      clearAttachment,
    });

    if (result.error) {
      return errorResponse(res, result.error.status, result.error.message);
    }

    return successResponse(res, result.data, "Task updated successfully");
  } catch (error) {
    console.error("Error updating task:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export default {
  createTask,
  getAllTasks,
  deleteTask,
  updateTask,
};
