import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getConstructionEtsRechargeSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id } = req.user;

    let result = await client.query(
      `
      SELECT enable_ets_supplier, enable_recharge_supplier, signature_section
      FROM construction_ets_recharge
      WHERE company_id = $1
        AND builder_id = $2
      LIMIT 1
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO construction_ets_recharge (
          company_id,
          builder_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING enable_ets_supplier, enable_recharge_supplier, signature_section;
        `,
        [company_id, builder_id, req.user.users_id, req.user.users_id],
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction ETS recharge settings fetched",
    );
  } catch (error) {
    console.error("Fetch Construction ETS Recharge Error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
}

export async function updateConstructionEtsRechargeSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    const {
      enable_ets_supplier,
      enable_recharge_supplier,
      signature_section,
    } = req.body;

    await client.query("BEGIN");

    const query = `
      INSERT INTO construction_ets_recharge (
        company_id,
        builder_id,
        enable_ets_supplier,
        enable_recharge_supplier,
        signature_section,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (company_id, builder_id)
      DO UPDATE SET
        enable_ets_supplier = 
          CASE 
            WHEN $3 IS NOT NULL THEN $3::boolean
            ELSE construction_ets_recharge.enable_ets_supplier
          END,
        enable_recharge_supplier = 
          CASE 
            WHEN $4 IS NOT NULL THEN $4::boolean
            ELSE construction_ets_recharge.enable_recharge_supplier
          END,
        signature_section = 
          CASE 
            WHEN $5 IS NOT NULL THEN $5::boolean
            ELSE construction_ets_recharge.signature_section
          END,
        updated_by = $7,
        updated_at = NOW()
      RETURNING enable_ets_supplier, enable_recharge_supplier, signature_section;
    `;

    const values = [
      company_id,
      builder_id,
      enable_ets_supplier ?? null,
      enable_recharge_supplier ?? null,
      signature_section ?? null,
      user_id,
      user_id,
    ];

    const { rows } = await client.query(query, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(rows[0]),
      "Construction ETS recharge settings saved successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Construction ETS Recharge Error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
}
