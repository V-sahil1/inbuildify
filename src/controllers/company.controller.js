const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const {
  getCompanyByBuilderId,
  upsertCompany,
} = require("../services/company.service");

exports.getCompany = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;

  try {
    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const company = await getCompanyByBuilderId(builderId, client);

    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    return successResponse(
      res,
      keysToCamelCase(company),
      "Company fetched successfully"
    );
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.upsertCompany = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;

  try {
    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    await client.query("BEGIN");

    const company = await upsertCompany(builderId, req.body, client);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(company),
      "Company saved successfully"
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return errorResponse(res, 500, err.message);
  } finally {
    client.release();
  }
};
