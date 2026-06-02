import db from "../config/database/models/postgre-models/index.js";

const toLogString = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") {
    return val.name || val.label || val.title || JSON.stringify(val);
  }
  return String(val);
};

/**
 * Logs an activity for a lead into the lead_activity_log table.
 * Supports both Sequelize transaction and raw calls via the ORM.
 *
 * @param {object} clientOrTransaction - Optional Sequelize transaction object.
 * @param {object} params - The activity log parameters.
 */
export const logActivity = async (clientOrTransaction, {
  userId,
  leadsId,
  module,
  moduleId,
  recordName,
  action,
  fieldName = null,
  oldValue = null,
  newValue = null,
  description = null,
  metadata = {},
}) => {
  try {
    const { LeadActivityLog } = db.sequelize?.models || db;

    // Detect if clientOrTransaction is a Sequelize Transaction
    const isTransaction = clientOrTransaction && typeof clientOrTransaction.commit === "function";

    await LeadActivityLog.create({
      leads_id: leadsId,
      user_id: userId,
      module,
      module_id: moduleId,
      record_name: recordName,
      action,
      field_name: fieldName,
      old_value: toLogString(oldValue),
      new_value: toLogString(newValue),
      description,
      metadata: metadata || null,
    }, {
      transaction: isTransaction ? clientOrTransaction : null
    });
  } catch (error) {
    console.error("[ActivityLogger] Error logging activity:", error);
  }
};

/**
 * Compares old and new data and logs an entry for each changed field.
 */
export const compareAndLogUpdates = async (clientOrTransaction, {
  userId,
  leadsId,
  module,
  moduleId,
  recordName,
  oldData,
  newData,
  metadata = {},
  ignoreFields = [],
}) => {
  const baseIgnore = [
    "updated_at", "created_at", "created_by", "updated_by",
    "updatedAt", "createdAt", "createdBy", "updatedBy",
    "is_deleted", "deleted_at", "isDeleted", "deletedAt",
    "id", "leadName", "createdbyname", "recipientName", "lead_name",
    "parentNoteContent", "contactName", "assigneeName",
  ];

  const allIgnore = [...baseIgnore, ...ignoreFields];

  for (const field in newData) {
    if (allIgnore.includes(field)) continue;

    // User Perspective: Avoid showing internal IDs
    if (field.toLowerCase().endsWith("id") || field.toLowerCase().endsWith("_id")) continue;

    const oldValue = oldData[field];
    const newValue = newData[field];

    const oldStr = toLogString(oldValue);
    const newStr = toLogString(newValue);

    // Check for changes (handling nulls and type differences)
    if (oldStr !== newStr && !(oldValue === null && newValue === undefined) && !(oldValue === undefined && newValue === null)) {
      await logActivity(clientOrTransaction, {
        userId,
        leadsId,
        module,
        moduleId,
        recordName,
        action: "UPDATE",
        fieldName: field,
        oldValue,
        newValue,
        description: `Updated ${field} for ${module}`,
        metadata,
      });
    }
  }
};
