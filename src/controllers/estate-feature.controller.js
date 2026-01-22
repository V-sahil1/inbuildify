const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createEstateFeature = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { estate_id, feature_name } = req.body;
    const builderId = req.user?.builder_id;

    await client.query("BEGIN");

    const estateCheck = await client.query(
      `SELECT estate_id FROM estate 
       WHERE estate_id = $1 AND builder_id = $2`,
      [estate_id, builderId],
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Estate not found or does not belong to this builder.",
      );
    }

    const estateActiveCheck = await client.query(
      `SELECT estate_id FROM estate 
       WHERE estate_id = $1 AND builder_id = $2 AND status = 'true'`,
      [estate_id, builderId],
    );

    if (estateActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive estate.");
    }

    const dupCheck = await client.query(
      `SELECT estate_feature_id FROM estate_features 
       WHERE estate_id = $1 AND LOWER(feature_name) = LOWER($2)`,
      [estate_id, feature_name],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Feature name already exists for this estate.",
      );
    }

    const insertQuery = `
      INSERT INTO estate_features (estate_id, feature_name)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [estate_id, feature_name]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Estate feature created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating estate feature:", err);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllEstateFeatures = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    let { page = 1, limit = 25 } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM estate_features ef
      JOIN estate e ON e.estate_id = ef.estate_id
      WHERE e.builder_id = $1
    `;

    const countResult = await client.query(countQuery, [builderId]);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT
        ef.estate_feature_id,
        ef.estate_id,
        ef.feature_name,
        ef.created_at
      FROM estate_features ef
      JOIN estate e ON e.estate_id = ef.estate_id
      WHERE e.builder_id = $1
      ORDER BY ef.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const dataResult = await client.query(dataQuery, [builderId]);

    return successResponse(
      res,
      {
        estateFeature: keysToCamelCase(dataResult.rows),
        records: total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      "Estate features fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching estate features:", err);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getEstateFeaturesByEstateId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { estate_id } = req.params;
    const builderId = req.user?.builder_id;

    const estateCheck = await client.query(
      `SELECT estate_id FROM estate 
       WHERE estate_id = $1 AND builder_id = $2`,
      [estate_id, builderId],
    );

    if (estateCheck.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Estate not found or does not belong to this builder.",
      );
    }

    const query = `
      SELECT 
        estate_feature_id,
        estate_id,
        feature_name,
        created_at
      FROM estate_features
      WHERE estate_id = $1
      ORDER BY created_at DESC
    `;

    const result = await client.query(query, [estate_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Estate features fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching estate features:", err);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteEstateFeature = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_feature_id } = req.params;
    const builderId = req.user?.builder_id;

    const featureCheck = await client.query(
      `SELECT estate_id 
       FROM estate_features 
       WHERE estate_feature_id = $1`,
      [estate_feature_id],
    );

    if (featureCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate feature not found.");
    }

    const estateId = featureCheck.rows[0].estate_id;

    const estateCheck = await client.query(
      `SELECT estate_id 
       FROM estate
       WHERE estate_id = $1 AND builder_id = $2`,
      [estateId, builderId],
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not allowed to delete features from this estate.",
      );
    }

    await client.query(
      `DELETE FROM estate_features 
       WHERE estate_feature_id = $1`,
      [estate_feature_id],
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Estate feature deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete estate feature error:", err);
    return errorResponse(res, 500, "Failed to delete estate feature.");
  } finally {
    client.release();
  }
};
