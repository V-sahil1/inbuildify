const REQUIRED_ROLES = ["super_admin", "admin", "project_owner", "service_provider", "client"];

const VALID_SORT_COLUMNS = ["created_at", "updated_at", "name"];

const DEFAULT_LIMIT = 25;

const MAX_BATCH_SIZE = 100;

const REQUEST_SOURCE = {
  BODY: "body",
  QUERY: "query",
  PARAMS: "params",
}

module.exports = {
  REQUIRED_ROLES,
  VALID_SORT_COLUMNS,
  DEFAULT_LIMIT,
  MAX_BATCH_SIZE,
  REQUEST_SOURCE,
};
