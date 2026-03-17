export async function isValidRole(client, role_id) {
  const result = await client.query(
    `
    SELECT 1
    FROM role
    WHERE role_id = $1
    `,
    [role_id],
  );

  return result.rowCount > 0;
}

export const VALID_SORT_COLUMNS = ["created_at", "updated_at", "name"];

export const DEFAULT_LIMIT = 25;

export const MAX_BATCH_SIZE = 100;

export const REQUEST_SOURCE = {
  BODY: "body",
  QUERY: "query",
  PARAMS: "params",
  FORM_DATA: "formData",
};

export const ALLOWED_FILE_TYPES = process.env.FILE_TYPES || "image/jpeg|image/png|image/jpg|application/pdf";
export const ALLOWED_FILE_SIZE = process.env.FILE_SIZE || 5;

export const ERROR_MESSAGES = {
  FORBIDDEN: "Forbidden",
  UNAUTHORIZED: "Unauthorized",
  INVALID_ROLE: "Invalid role",
};
