const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobColorSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId || !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `SELECT 1 FROM job_color_settings WHERE builder_id = $1 OR company_id = $2`,
      [builderId, companyId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Job color settings already exist for this builder/company."
      );
    }
    const {
      hide_color_item_images,
      hide_color_item_price,
      exit_color_code,
      page_orientation_portrait,
      header_text,
    } = req.body;

    const insertQuery = `
      INSERT INTO job_color_settings (
        company_id,
        builder_id,
        hide_color_item_images,
        hide_color_item_price,
        exit_color_code,
        page_orientation_portrait,
        header_text,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, 
        $3, $4, $5, 
        $6, $7, $8, 
        $9
      )
      RETURNING 
       *
    `;

    const values = [
      companyId,
      builderId,
      hide_color_item_images ?? false,
      hide_color_item_price ?? false,
      exit_color_code ?? false,
      page_orientation_portrait ?? true,
      header_text || null,
      userId,
      userId,
    ];
    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color settings created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job color settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobColorSetting = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID."
      );
    }

    const {
      hide_color_item_images,
      hide_color_item_price,
      exit_color_code,
      page_orientation_portrait,
      header_text,
    } = req.body;

    await client.query("BEGIN");

    const checkRecord = await client.query(
      `
      SELECT 1
      FROM job_color_settings
      WHERE (builder_id = $1 OR company_id = $2)
      `,
      [builderId, companyId]
    );

    if (checkRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job color settings not found for this user."
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (hide_color_item_images !== undefined) {
      fields.push(`hide_color_item_images = $${i++}`);
      values.push(hide_color_item_images);
    }
    if (hide_color_item_price !== undefined) {
      fields.push(`hide_color_item_price = $${i++}`);
      values.push(hide_color_item_price);
    }
    if (exit_color_code !== undefined) {
      fields.push(`exit_color_code = $${i++}`);
      values.push(exit_color_code);
    }
    if (page_orientation_portrait !== undefined) {
      fields.push(`page_orientation_portrait = $${i++}`);
      values.push(page_orientation_portrait);
    }
    if (header_text !== undefined) {
      fields.push(`header_text = $${i++}`);
      values.push(header_text);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields provided for update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_color_settings
      SET ${fields.join(", ")}
      WHERE (builder_id = $${i} OR company_id = $${i + 1})
      RETURNING hide_color_item_images,
        hide_color_item_price,
        exit_color_code,
        page_orientation_portrait,
        header_text;
    `;

    values.push(builderId, companyId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color settings updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job color settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserJobColorSettings = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    let result = await client.query(
      `
      SELECT *
      FROM job_color_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO job_color_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        RETURNING  hide_color_item_images,
        hide_color_item_price,
        exit_color_code,
        page_orientation_portrait,
        header_text
        `,
        [company_id, builder_id, user_id]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color settings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching job color settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
