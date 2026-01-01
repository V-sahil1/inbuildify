async function isValidRole(client, role_id) {
  const result = await client.query(
    `
    SELECT 1
    FROM role
    WHERE role_id = $1
    `,
    [role_id]
  );

  return result.rowCount > 0;
}

const VALID_SORT_COLUMNS = ["created_at", "updated_at", "name"];

const DEFAULT_LIMIT = 25;

const MAX_BATCH_SIZE = 100;

const REQUEST_SOURCE = {
  BODY: "body",
  QUERY: "query",
  PARAMS: "params",
  FORM_DATA: "formData",
};

const ALLOWED_FILE_TYPES = process.env.FILE_TYPES;
const ALLOWED_FILE_SIZE = process.env.FILE_SIZE;

module.exports = {
  isValidRole,
  VALID_SORT_COLUMNS,
  DEFAULT_LIMIT,
  MAX_BATCH_SIZE,
  REQUEST_SOURCE,
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_SIZE,
};
