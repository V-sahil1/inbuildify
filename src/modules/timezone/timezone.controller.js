const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.getAllTimezones = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const dataQuery = `
      SELECT
        *
      FROM timezones
      ORDER BY utc_offset_minutes, display_name;
    `;

    const dataResult = await client.query(dataQuery);

    return successResponse(
      res,
      {
        timezones: keysToCamelCase(dataResult.rows),
      },
      "Timezones fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching timezones:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
