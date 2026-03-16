import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createAddress(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const {
      country_id,
      state_id,
      address_line1,
      address_line2,
      city,
      zip_code,
    } = req.body;

    if (country_id) {
      const countryIdCheck = await client.query(
        "SELECT country_id FROM country WHERE country_id = $1 LIMIT 1",
        [country_id],
      );

      if (countryIdCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid country id. country not found.",
        );
      }
    }

    if (state_id) {
      const stateCheck = await client.query(
        "SELECT state_id FROM state WHERE state_id = $1 LIMIT 1",
        [state_id],
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id. state not found.");
      }
    }

    if (!address_line1) {
      return errorResponse(res, 400, "Address Line 1 is required.");
    }

    await client.query("BEGIN");

    const insertQuery = `
      INSERT INTO address (
        country_id, state_id, address_line1, address_line2, city, zip_code
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      country_id || null,
      state_id || null,
      address_line1,
      address_line2 || null,
      city || null,
      zip_code || null,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Address created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating address:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
