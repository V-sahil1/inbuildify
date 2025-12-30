const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobColorColumnSection = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_color_settings_id, section_name, sort_order } = req.body;

    const attachment = req.body.attachment_url || null;

    if (!job_color_settings_id || !section_name) {
      return errorResponse(
        res,
        400,
        "job_color_settings_id and section_name are required."
      );
    }

    await client.query("BEGIN");
    const settingsCheck = await client.query(
      `
      SELECT job_color_settings_id
      FROM job_color_settings
      WHERE job_color_settings_id = $1
      `,
      [job_color_settings_id]
    );

    if (settingsCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid job_color_settings_id.");
    }

    let finalSortOrder = sort_order ?? 1;

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_color_column_sections
      WHERE job_color_settings_id = $1;
    `;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      job_color_settings_id,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`
      );
    }

    const shiftSortOrderQuery = `
      UPDATE job_color_column_sections
      SET sort_order = sort_order + 1
      WHERE job_color_settings_id = $1
        AND sort_order >= $2;
    `;

    await client.query(shiftSortOrderQuery, [
      job_color_settings_id,
      finalSortOrder,
    ]);

    const insertQuery = `
      INSERT INTO job_color_column_sections (
        job_color_settings_id,
        section_name,
        attachments,
        sort_order
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const values = [
      job_color_settings_id,
      section_name,
      attachment,
      finalSortOrder,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color column section created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Job Color Column Section Error:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
