const REQUIRED_ROLES = ["super_admin", "admin", "project_owner", "service_provider", "client"];

const VALID_SORT_COLUMNS = ["created_at", "updated_at", "name"];

const DEFAULT_LIMIT = 25;

const MAX_BATCH_SIZE = 100;

module.exports = {
  REQUIRED_ROLES,
  VALID_SORT_COLUMNS,
  DEFAULT_LIMIT,
  MAX_BATCH_SIZE,
};
