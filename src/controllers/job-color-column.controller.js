const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobColorColumn = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { column_name, display_option, sort_order, width } = req.body;

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    await client.query("BEGIN");

    const jobColorSettingsResult = await client.query(
      `SELECT job_color_settings_id 
       FROM job_color_settings 
       WHERE builder_id = $1`,
      [builderId]
    );

    if (jobColorSettingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job color settings not found for this builder."
      );
    }
    const jobColorSettingsId =
      jobColorSettingsResult.rows[0].job_color_settings_id;

    if (
      display_option === "show_in_existing_items_column" &&
      ((sort_order !== null && sort_order !== undefined) ||
        (width !== null && width !== undefined))
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "When display_option is 'show_in_existing_items_column', both sort_order and width must be null."
      );
    }

    if (display_option !== "show_in_existing_items_column") {
      if (
        sort_order === null ||
        sort_order === undefined ||
        width === null ||
        width === undefined
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "sort_order and width are required when display_option is not 'show_in_existing_items_column'."
        );
      }
    }

    if (sort_order !== null && sort_order !== undefined) {
      const dupSortCheck = await client.query(
        `SELECT 1 
         FROM job_color_columns 
         WHERE job_color_settings_id = $1 
         AND sort_order = $2`,
        [jobColorSettingsId, sort_order]
      );

      if (dupSortCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Sort order already exists for this setting."
        );
      }
    }

    const insertQuery = `
      INSERT INTO job_color_columns (
        job_color_settings_id,
        column_name,
        display_option,
        sort_order,
        width
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        *;
    `;

    const insertValues = [
      jobColorSettingsId,
      column_name,
      display_option,
      sort_order || null,
      width || null,
    ];

    const result = await client.query(insertQuery, insertValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color column created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job color column:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllJobColorColumns = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM job_color_columns jcc
      INNER JOIN job_color_settings jcs 
      ON jcc.job_color_settings_id = jcs.job_color_settings_id
      WHERE jcs.builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        jcc.job_color_column_id,
        jcc.job_color_settings_id,
        jcc.column_name,
        jcc.display_option,
        jcc.sort_order,
        jcc.width,
        jcc.created_at,
        jcc.updated_at
      FROM job_color_columns jcc
      INNER JOIN job_color_settings jcs 
      ON jcc.job_color_settings_id = jcs.job_color_settings_id
      WHERE jcs.builder_id = $1
      ORDER BY jcc.sort_order ASC
      LIMIT $2 OFFSET $3;
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      limit,
      offset,
    ]);

    return successResponse(
      res,
      {
        jobColorColumn: keysToCamelCase(dataResult.rows),
        totalRecord: total,
        curruntPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      "Job color columns fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching job color columns:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobColorColumn = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { column_name, display_option, sort_order, width } = req.body;

    if (
      !column_name &&
      !display_option &&
      sort_order === undefined &&
      width === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update."
      );
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT jcc.*
      FROM job_color_columns jcc
      INNER JOIN job_color_settings jcs 
      ON jcc.job_color_settings_id = jcs.job_color_settings_id
      WHERE jcc.job_color_column_id = $1 AND jcs.builder_id = $2;
      `,
      [id, builderId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job color column not found for this builder."
      );
    }

    const old = existing.rows[0];
    const oldDisplay = old.display_option;

    if (oldDisplay === "show_in_existing_items_column") {
      if (!display_option) {
        if (sort_order !== undefined || width !== undefined) {
          return errorResponse(
            res,
            400,
            "Cannot update sort_order or width unless you change display_option away from 'show_in_existing_items_column'."
          );
        }
      }

      if (
        display_option === "dont_show" ||
        display_option === "show_as_separate_column"
      ) {
        if (sort_order === undefined || width === undefined) {
          return errorResponse(
            res,
            400,
            "sort_order and width are required when changing from 'show_in_existing_items_column'."
          );
        }
      }
    }

    if (
      display_option &&
      (display_option === "dont_show" ||
        display_option === "show_as_separate_column")
    ) {
      if (sort_order === undefined || width === undefined) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "sort_order and width are required when changing display_option to 'dont_show' or 'show_as_separate_column'."
        );
      }
    }

    let finalSortOrder = sort_order;
    let finalWidth = width;

    if (display_option === "show_in_existing_items_column") {
      if (sort_order !== undefined || width !== undefined) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Do not send sort_order or width when changing display_option to 'show_in_existing_items_column'."
        );
      }

      finalSortOrder = null;
      finalWidth = null;
    } else {
      finalSortOrder =
        finalSortOrder === undefined ? old.sort_order : finalSortOrder;
      finalWidth = finalWidth === undefined ? old.width : finalWidth;
    }

    if (
      finalSortOrder !== null &&
      display_option !== "show_in_existing_items_column"
    ) {
      const duplicate = await client.query(
        `
        SELECT 1 FROM job_color_columns
        WHERE job_color_settings_id = $1
        AND sort_order = $2
        AND job_color_column_id != $3;
        `,
        [old.job_color_settings_id, finalSortOrder, id]
      );

      if (duplicate.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Duplicate sort_order not allowed within the same settings."
        );
      }
    }

    const result = await client.query(
      `
      UPDATE job_color_columns
      SET 
        column_name = COALESCE($1, column_name),
        display_option = COALESCE($2, display_option),
        sort_order = $3,
        width = $4,
        updated_at = NOW()
      WHERE job_color_column_id = $5
      RETURNING *;
      `,
      [column_name, display_option, finalSortOrder, finalWidth, id]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color column updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job color column:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
