const getPool = require("../config/database");
const { errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { successResponse } = require("../helper/response");

exports.getState = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const country_id = req.params.country_id;

    const country = await client.query(`SELECT * FROM country WHERE country_id = $1 AND name = $2`, [country_id, 'australia']);
    if (country.rowCount === 0) {
      return errorResponse(res, 404, "Country not found.");
    }

    const query = `SELECT * FROM state WHERE country_id = $1;`;
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
};
