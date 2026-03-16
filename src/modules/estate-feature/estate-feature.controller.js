import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createEstateFeature(req, res) {
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
}

export async function getAllEstateFeatures(req, res) {
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
}

export async function getEstateFeaturesByEstateId(req, res) {
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
}

export async function deleteEstateFeature(req, res) {
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
}

export async function updateEstateFeature(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_feature_id } = req.params;
    const { feature_name } = req.body;
    const builderId = req.user?.builder_id;

    // Check if feature exists and belongs to builder's estate
    const featureCheck = await client.query(
      `SELECT ef.estate_feature_id, ef.estate_id, ef.feature_name
       FROM estate_features ef
       JOIN estate e ON ef.estate_id = e.estate_id
       WHERE ef.estate_feature_id = $1 AND e.builder_id = $2`,
      [estate_feature_id, builderId],
    );

    if (featureCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate feature not found or does not belong to this builder.");
    }

    // Check if estate is active
    const estateId = featureCheck.rows[0].estate_id;
    const estateActiveCheck = await client.query(
      `SELECT estate_id FROM estate 
       WHERE estate_id = $1 AND builder_id = $2 AND status = 'true'`,
      [estateId, builderId],
    );

    if (estateActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive estate.");
    }

    // Check for duplicate feature name (excluding current feature)
    const dupCheck = await client.query(
      `SELECT estate_feature_id FROM estate_features 
       WHERE estate_id = $1 AND LOWER(feature_name) = LOWER($2) AND estate_feature_id != $3`,
      [estateId, feature_name, estate_feature_id],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Feature name already exists for this estate.",
      );
    }

    // Update the feature
    const updateQuery = `
      UPDATE estate_features 
      SET feature_name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE estate_feature_id = $2
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [feature_name, estate_feature_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Estate feature updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating estate feature:", err);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
