import getPool from "../config/database";

const getMailTemplate = async (templateKey) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    let query = "SELECT * FROM email_templates";
    let params = [];

    if (templateKey) {
      query += " WHERE template_key = $1 LIMIT 1;";
      params = [templateKey];
    }

    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Get email templates error:", error);
    throw error;
  } finally {
    client.release();
  }
};

export default getMailTemplate;
