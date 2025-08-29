const REQUIRED_ROLES = ["super_admin", "admin", "project_owner", "service_provider", "client"];

const VALID_SORT_COLUMNS = ["created_at", "updated_at", "name"];

const DEFAULT_LIMIT = 25;

const MAX_BATCH_SIZE = 100;

const REQUEST_SOURCE = {
  BODY: "body",
  QUERY: "query",
  PARAMS: "params",
  FORM_DATA: "formData",
}

const ALLOWED_FILE_TYPES = process.env.FILE_TYPES;
const ALLOWED_FILE_SIZE = process.env.FILE_SIZE;

module.exports = {
  REQUIRED_ROLES,
  VALID_SORT_COLUMNS,
  DEFAULT_LIMIT,
  MAX_BATCH_SIZE,
  REQUEST_SOURCE,
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_SIZE,
};
