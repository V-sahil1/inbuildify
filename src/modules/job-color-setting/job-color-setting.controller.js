import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

const DEFAULT_JOB_COLOR_COLUMNS = [
  {
    column_name: "Colour",
    display_option: "show_as_separate_column",
    sort_order: 1,
    width: null,
  },
  {
    column_name: "Description",
    display_option: "show_in_existing_items_column",
    sort_order: null,
    width: null,
  },
  {
    column_name: "Code",
    display_option: "show_in_existing_items_column",
    sort_order: null,
    width: null,
  },
  {
    column_name: "Images",
    display_option: "show_as_separate_column",
    sort_order: 2,
    width: 20,
  },
  {
    column_name: "Specification",
    display_option: "show_in_existing_items_column",
    sort_order: null,
    width: null,
  },
  {
    column_name: "Item Name",
    display_option: "show_as_separate_column",
    sort_order: 4,
    width: 20,
  },
  {
    column_name: "Items",
    display_option: "show_as_separate_column",
    sort_order: 5,
    width: 20,
  },
  {
    column_name: "Feature",
    display_option: "show_in_existing_items_column",
    sort_order: null,
    width: null,
  },
  {
    column_name: "Supplier",
    display_option: "show_in_existing_items_column",
    sort_order: null,
    width: null,
  },
  {
    column_name: "Cost",
    display_option: "show_as_separate_column",
    sort_order: 6,
    width: 20,
  },
];

export async function createJobColorSettings(req, res) {
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
        "Unauthorized: Missing builder or company ID.",
      );
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      "SELECT 1 FROM job_color_settings WHERE builder_id = $1 OR company_id = $2",
      [builderId, companyId],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Job color settings already exist for this builder/company.",
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
      "Job color settings created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating job color settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateJobColorSetting(req, res) {
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
        "Unauthorized: Missing builder or company ID.",
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
      [builderId, companyId],
    );

    if (checkRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job color settings not found for this user.",
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
    fields.push("updated_at = NOW()");

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
      "Job color settings updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating job color settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getUserJobColorSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    await client.query("BEGIN");

    let result = await client.query(
      `
      SELECT *
      FROM job_color_settings
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1;
      `,
      [company_id, builder_id],
    );

    // 👉 Create settings if not exist
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
        RETURNING *
        `,
        [company_id, builder_id, user_id],
      );
    }

    const jobColorSettingsId = result.rows[0].job_color_settings_id;

    // 👉 CHECK default columns exist or not
    const columnCheck = await client.query(
      `
      SELECT 1
      FROM job_color_columns
      WHERE job_color_settings_id = $1
      LIMIT 1
      `,
      [jobColorSettingsId],
    );

    // 👉 Insert defaults only once
    if (columnCheck.rowCount === 0) {
      const insertColumnQuery = `
        INSERT INTO job_color_columns (
          job_color_settings_id,
          column_name,
          display_option,
          sort_order,
          width
        )
        VALUES ($1, $2, $3, $4, $5)
      `;

      for (const col of DEFAULT_JOB_COLOR_COLUMNS) {
        await client.query(insertColumnQuery, [
          jobColorSettingsId,
          col.column_name,
          col.display_option,
          col.sort_order,
          col.width,
        ]);
      }
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color settings fetched successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching job color settings:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}
