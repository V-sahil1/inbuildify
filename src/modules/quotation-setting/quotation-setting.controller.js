import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createQuotationSettings(req, res) {
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

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      "SELECT 1 FROM quotation_settings WHERE builder_id = $1 OR company_id = $2",
      [builderId, companyId],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Quotation settings already exist for this builder/company.",
      );
    }

    const {
      allow_save_as_new_version,
      mandatory_contact_details,
      mandatory_dwelling_type,
      mandatory_sketch_number,
      mandatory_land_title,
      enable_dwelling_size,
      enable_builder_cost,
      allow_notes,
      allow_cost_adjustment,
      show_notes_by_default,
      allow_multiple_packages,
      include_additional_items_in_price_adjusted_list,
      auto_approve_on_sales_won,
      show_default_pricelist_in_additional_items,
      hide_price_to_customer,
      enable_estimated_price_range,
      quotation_validity_days,
      extend_validity_from_updated_date,
      rename_send_for_approval_button,
      default_pricelist_id,
    } = req.body;

    if (default_pricelist_id) {
      const priceListCheck = await client.query(
        `SELECT price_list_id 
         FROM price_list 
         WHERE price_list_id = $1 AND builder_id = $2 AND company_id = $3`,
        [default_pricelist_id, builderId, companyId],
      );

      if (priceListCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid default_pricelist_id. Price list not found.",
        );
      }
    }

    if (default_pricelist_id) {
      const priceListActiveCheck = await client.query(
        `SELECT price_list_id 
         FROM price_list 
         WHERE price_list_id = $1 AND builder_id = $2 AND company_id = $3 AND is_active = true`,
        [default_pricelist_id, builderId, companyId],
      );

      if (priceListActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive price list.");
      }
    }

    const insertQuery = `
      INSERT INTO quotation_settings (
        company_id,
        builder_id,
        allow_save_as_new_version,
        mandatory_contact_details,
        mandatory_dwelling_type,
        mandatory_sketch_number,
        mandatory_land_title,
        enable_dwelling_size,
        enable_builder_cost,
        allow_notes,
        allow_cost_adjustment,
        show_notes_by_default,
        allow_multiple_packages,
        include_additional_items_in_price_adjusted_list,
        auto_approve_on_sales_won,
        show_default_pricelist_in_additional_items,
        hide_price_to_customer,
        enable_estimated_price_range,
        quotation_validity_days,
        extend_validity_from_updated_date,
        rename_send_for_approval_button,
        default_pricelist_id,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2,
        $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23, $24
      )
      RETURNING *
    `;

    const values = [
      companyId,
      builderId,

      allow_save_as_new_version ?? true,
      mandatory_contact_details ?? true,
      mandatory_dwelling_type ?? true,
      mandatory_sketch_number ?? true,
      mandatory_land_title ?? false,
      enable_dwelling_size ?? false,
      enable_builder_cost ?? false,
      allow_notes ?? true,
      allow_cost_adjustment ?? true,
      show_notes_by_default ?? true,
      allow_multiple_packages ?? false,
      include_additional_items_in_price_adjusted_list ?? false,
      auto_approve_on_sales_won ?? false,
      show_default_pricelist_in_additional_items ?? true,
      hide_price_to_customer ?? false,
      enable_estimated_price_range ?? false,

      quotation_validity_days || 30,
      extend_validity_from_updated_date || 0,
      rename_send_for_approval_button || null,
      default_pricelist_id || null,

      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Quotation settings created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating quotation settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getQuotationSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    if (!companyId || !builderId) {
      return errorResponse(res, 400, "Invalid user authentication");
    }

    const query = `
      SELECT 
       *
      FROM quotation_settings
      WHERE company_id = $1
        AND builder_id = $2;
    `;

    const result = await client.query(query, [companyId, builderId]);
    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Quotation settings fetched successfully.",
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateQuotationSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { quotation_settings_id } = req.params;

    if (!quotation_settings_id) {
      return errorResponse(res, 400, "quotation_settings_id is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM quotation_settings 
       WHERE quotation_settings_id = $1 
       AND (builder_id = $2 OR company_id = $3)`,
      [quotation_settings_id, builderId, companyId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Quotation settings not found or access denied.",
      );
    }

    const old = existing.rows[0];

    const {
      allow_save_as_new_version,
      mandatory_contact_details,
      mandatory_dwelling_type,
      mandatory_sketch_number,
      mandatory_land_title,
      enable_dwelling_size,
      enable_builder_cost,
      allow_notes,
      allow_cost_adjustment,
      show_notes_by_default,
      allow_multiple_packages,
      include_additional_items_in_price_adjusted_list,
      auto_approve_on_sales_won,
      show_default_pricelist_in_additional_items,
      hide_price_to_customer,
      enable_estimated_price_range,
      quotation_validity_days,
      extend_validity_from_updated_date,
      rename_send_for_approval_button,
      default_pricelist_id,
    } = req.body;

    const hasAtLeastOneField = Object.values(req.body).some(
      (v) => v !== undefined,
    );

    if (!hasAtLeastOneField) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    if (default_pricelist_id !== undefined && default_pricelist_id !== null) {
      const checkPriceList = await client.query(
        `SELECT price_list_id 
         FROM price_list 
         WHERE price_list_id = $1 AND builder_id = $2 AND company_id = $3`,
        [default_pricelist_id, builderId, companyId],
      );

      if (checkPriceList.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid default_pricelist_id.");
      }

      const activeCheck = await client.query(
        `SELECT price_list_id 
         FROM price_list 
         WHERE price_list_id = $1 
           AND builder_id = $2 
           AND company_id = $3 
           AND is_active = true`,
        [default_pricelist_id, builderId, companyId],
      );

      if (activeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive default price list.");
      }
    }

    const updateQuery = `
      UPDATE quotation_settings
      SET
        allow_save_as_new_version = $1,
        mandatory_contact_details = $2,
        mandatory_dwelling_type = $3,
        mandatory_sketch_number = $4,
        mandatory_land_title = $5,
        enable_dwelling_size = $6,
        enable_builder_cost = $7,
        allow_notes = $8,
        allow_cost_adjustment = $9,
        show_notes_by_default = $10,
        allow_multiple_packages = $11,
        include_additional_items_in_price_adjusted_list = $12,
        auto_approve_on_sales_won = $13,
        show_default_pricelist_in_additional_items = $14,
        hide_price_to_customer = $15,
        enable_estimated_price_range = $16,
        quotation_validity_days = $17,
        extend_validity_from_updated_date = $18,
        rename_send_for_approval_button = $19,
        default_pricelist_id = $20,
        updated_by = $21,
        updated_at = NOW()
      WHERE quotation_settings_id = $22 
        AND (builder_id = $23 OR company_id = $24)
      RETURNING *;
    `;

    const values = [
      allow_save_as_new_version ?? old.allow_save_as_new_version,
      mandatory_contact_details ?? old.mandatory_contact_details,
      mandatory_dwelling_type ?? old.mandatory_dwelling_type,
      mandatory_sketch_number ?? old.mandatory_sketch_number,
      mandatory_land_title ?? old.mandatory_land_title,
      enable_dwelling_size ?? old.enable_dwelling_size,
      enable_builder_cost ?? old.enable_builder_cost,
      allow_notes ?? old.allow_notes,
      allow_cost_adjustment ?? old.allow_cost_adjustment,
      show_notes_by_default ?? old.show_notes_by_default,
      allow_multiple_packages ?? old.allow_multiple_packages,
      include_additional_items_in_price_adjusted_list ??
        old.include_additional_items_in_price_adjusted_list,
      auto_approve_on_sales_won ?? old.auto_approve_on_sales_won,
      show_default_pricelist_in_additional_items ??
        old.show_default_pricelist_in_additional_items,
      hide_price_to_customer ?? old.hide_price_to_customer,
      enable_estimated_price_range ?? old.enable_estimated_price_range,
      quotation_validity_days ?? old.quotation_validity_days,
      extend_validity_from_updated_date ??
        old.extend_validity_from_updated_date,
      rename_send_for_approval_button ?? old.rename_send_for_approval_button,
      default_pricelist_id ?? old.default_pricelist_id,
      userId,
      quotation_settings_id,
      builderId,
      companyId,
    ];

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Quotation settings updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating quotation settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getQuotationSetting(req, res) {
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
      FROM quotation_settings
      WHERE company_id = $1 AND builder_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO quotation_settings (
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
        quotationSettings: keysToCamelCase(result.rows[0]),
      },
      "Quotation Settings fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching quotation settings:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
