import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function updateSalesModuleSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const {
      allow_duplicate_leads,
      send_email_on_new_lead,
      show_common_folders,
      lead_mandatory_option,
      role_id,
      sales_won_button_text,
      house_size_unit,
    } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM sales_module_settings 
       WHERE builder_id = $1
       LIMIT 1;`,
      [builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "No sales module settings found for this builder.",
      );
    }

    if (
      allow_duplicate_leads === undefined &&
      send_email_on_new_lead === undefined &&
      show_common_folders === undefined &&
      lead_mandatory_option === undefined &&
      role_id === undefined &&
      sales_won_button_text === undefined &&
      house_size_unit === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update.",
      );
    }

    if (role_id && role_id.length > 0) {
      const checkRoleQuery = `
        SELECT role_id 
        FROM role
        WHERE role_id = ANY($1::uuid[]) 
      `;
      const validRoles = await client.query(checkRoleQuery, [role_id]);

      if (validRoles.rows.length !== role_id.length) {
        return errorResponse(
          res,
          400,
          "One or more provided role id are invalid.",
        );
      }
    }

    const updateQuery = `
      UPDATE sales_module_settings
      SET
        allow_duplicate_leads = COALESCE($2, allow_duplicate_leads),
        send_email_on_new_lead = COALESCE($3, send_email_on_new_lead),
        show_common_folders = COALESCE($4, show_common_folders),
        lead_mandatory_option = COALESCE($5, lead_mandatory_option),
        role_id = COALESCE($6::uuid[], role_id),
        sales_won_button_text = COALESCE($7, sales_won_button_text),
        house_size_unit = COALESCE($8, house_size_unit),
        updated_by = $9,
        updated_at = NOW()
      WHERE builder_id = $1
      RETURNING *;
    `;
    const values = [
      builderId,
      allow_duplicate_leads,
      send_email_on_new_lead,
      show_common_folders,
      lead_mandatory_option,
      role_id,
      sales_won_button_text,
      house_size_unit,
      userId,
    ];

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales module settings updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating sales module settings:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getSalesModuleSetting(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    if (!company_id || !builder_id) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let result = await client.query(
      `
      SELECT *
      FROM sales_module_settings
      WHERE company_id = $1 AND builder_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO sales_module_settings (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *;
        `,
        [company_id, builder_id, user_id, user_id],
      );
    }

    return successResponse(
      res,
      {
        salesModuleSettings: keysToCamelCase(result.rows[0]),
      },
      "Sales Module Settings fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching sales module settings:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
