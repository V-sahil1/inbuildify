const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getUsersByBuilderId = async (req, res) => {
    const builderId = req.user.builder_id;
    console.log("🚀 ~ exports.getUsersByBuilderId= ~ builderId:", builderId)
    const pool = getPool();
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM users 
        WHERE builder_id = $1 AND is_deleted = false;
      `;
      const result = await client.query(query, [builderId]);
  
      const userData = result.rows.map((user) => ({
        usersId: user.users_id,
        builderId: user.builder_id,
        name: user.name,
        email: user.email,
        isVerified: user.is_verified,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })); 
      return successResponse(
        res,
        userData,
        "Users fetched successfully."
      );
    } catch (error) {
      console.error("Get users error:", error);
      return errorResponse(res, 500, "Internal Server Error");
    } finally {
      client.release();
    }
  };