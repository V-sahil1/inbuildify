const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");

exports.getAllCategories = async (req, res) => {
  const { limit, offset } = req.query;
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM categories LIMIT $1 OFFSET $2`,
      [parsedLimit, parsedOffset]
    );

    const totalResult = await client.query(`SELECT COUNT(*) FROM categories`);

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        categories: result.rows,
        pagination: {
          totalItems,
          totalPages,
          currentPage,
          limit: parsedLimit,
        },
      },
      "Categories fetched successfully."
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Failed to fetch categories."
    );
  } finally {
    client.release();
  }
};
