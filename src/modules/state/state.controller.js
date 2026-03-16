import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getState(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const country_id = req.params.country_id;

    const country = await client.query("SELECT * FROM country WHERE country_id = $1 AND name = $2", [country_id, "australia"]);
    if (country.rowCount === 0) {
      return errorResponse(res, 404, "Country not found.");
    }

    const query = "SELECT * FROM state WHERE country_id = $1;";
    const result = await client.query(query, [country_id]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "State not found with this country.");
    }

    successResponse(res, keysToCamelCase(result.rows), "State fetched successfully.");
  } catch (error) {
    errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
}

export async function getAllStates(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT s.*, c.name as country_name 
      FROM state s 
      JOIN country c ON s.country_id = c.country_id 
      WHERE c.name = 'australia'
      ORDER BY s.name;
    `;
    const result = await client.query(query);

    successResponse(res, keysToCamelCase(result.rows), "All states fetched successfully.");
  } catch (error) {
    errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
}
