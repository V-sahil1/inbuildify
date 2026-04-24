import getPool from "../config/database.js";

const toLogString = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    return val.name || val.label || val.title || JSON.stringify(val);
  }
  return String(val);
};

/**
 * Logs an activity for a lead into the lead_activity_log table.
 * 
 * @param {object} client - The database client to use for the insert (optional if no transaction).
 * @param {object} params - The activity log parameters.
 */
export const logActivity = async (client, {
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
  metadata = {}
}) => {
  const pool = client || getPool();
  try {
    const query = `
      INSERT INTO lead_activity_log (
        leads_id, user_id, module, module_id, record_name, action, 
        field_name, old_value, new_value, description, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;

    const values = [
      leadsId,
      userId,
      module,
      moduleId,
      recordName,
      action,
      fieldName,
      toLogString(oldValue),
      toLogString(newValue),
      description,
      metadata ? JSON.stringify(metadata) : null,
    ];
    await pool.query(query, values);
  } catch (error) {
    console.error(`[ActivityLogger] Error logging activity:`, error);
  }
};

/**
 * Compares old and new data and logs an entry for each changed field.
 */
export const compareAndLogUpdates = async (client, {
  userId,
  leadsId,
  module,
  moduleId,
  recordName,
  oldData,
  newData,
  metadata = {},
  ignoreFields = []
}) => {
  const baseIgnore = [
    'updated_at', 'created_at', 'created_by', 'updated_by', 
    'updatedAt', 'createdAt', 'createdBy', 'updatedBy',
    'is_deleted', 'deleted_at', 'isDeleted', 'deletedAt',
    'id', 'leadName', 'createdbyname', 'recipientName', 'lead_name',
    'parentNoteContent', 'contactName', 'assigneeName'
  ];
  
  const allIgnore = [...baseIgnore, ...ignoreFields];

  for (const field in newData) {
    if (allIgnore.includes(field)) continue;
    
    // User Perspective: Avoid showing internal IDs
    if (field.toLowerCase().endsWith('id') || field.toLowerCase().endsWith('_id')) continue;

    const oldValue = oldData[field];
    const newValue = newData[field];

    const oldStr = toLogString(oldValue);
    const newStr = toLogString(newValue);

    // Check for changes (handling nulls and type differences)
    if (oldStr !== newStr && !(oldValue === null && newValue === undefined) && !(oldValue === undefined && newValue === null)) {
      await logActivity(client, {
        userId,
        leadsId,
        module,
        moduleId,
        recordName,
        action: 'UPDATE',
        fieldName: field,
        oldValue,
        newValue,
        description: `Updated ${field} for ${module}`,
        metadata
      });
    }
  }
};
