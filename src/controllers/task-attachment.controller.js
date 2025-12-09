const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createTaskAttachment = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const uploadedBy = req.user?.user_id;
    const builderId = req.user?.builder_id;

    const file_image = req.body.file_image || null;
    const { task_id, file_name } = req.body;

    await client.query("BEGIN");

    const checkTask = await client.query(
      `SELECT task_id FROM task WHERE task_id = $1 AND builder_id = $2`,
      [task_id, builderId]
    );

    if (checkTask.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Task not found for this builder.");
    }

    const insertQuery = `
      INSERT INTO task_attachment (
        task_id,
        file_url,
        file_name,
        uploaded_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const values = [task_id, file_image, file_name || null, uploadedBy || null];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Task attachment created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating task attachment:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
