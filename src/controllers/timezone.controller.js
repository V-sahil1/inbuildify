const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllTimezones = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT
        *
      FROM timezones
      ORDER BY utc_offset_minutes, display_name
      LIMIT $1 OFFSET $2;
    `;

    const dataResult = await client.query(dataQuery, [limitValue, offset]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM timezones;
    `;

    const countResult = await client.query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        timezones: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
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
