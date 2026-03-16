import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createHouseLandPackageSetting(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { include_facade_cost_in_total } = req.body;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      "SELECT 1 FROM house_land_package_settings WHERE builder_id = $1",
      [builderId],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Settings already exist for this builder.",
      );
    }

    const insertQuery = `
      INSERT INTO house_land_package_settings (
        company_id,
        builder_id,
        include_facade_cost_in_total,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING house_land_package_settings_id, company_id, builder_id, include_facade_cost_in_total, created_by, updated_by, created_at, updated_at;
    `;

    const values = [
      companyId,
      builderId,
      include_facade_cost_in_total || false,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "house land package setting created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating house land package settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getHouseLandPackagesetting(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID not found in user context.");
    }

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    await client.query("BEGIN");

    const getQuery = `
      SELECT *
      FROM house_land_package_settings
      WHERE company_id = $1 AND builder_id = $2
      LIMIT 1;
    `;

    const result = await client.query(getQuery, [companyId, builderId]);

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return successResponse(
        res,
        {},
        "No house land package settings found. Please create one.",
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "house land package settings fetched successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error fetching house land package settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateHouseLandPackageSetting(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { include_facade_cost_in_total } = req.body;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    if (include_facade_cost_in_total === undefined) {
      return errorResponse(
        res,
        400,
        "include_facade_cost_in_total field is required.",
      );
    }

    await client.query("BEGIN");
    const existingRecord = await client.query(
      `SELECT house_land_package_settings_id 
       FROM house_land_package_settings 
       WHERE house_land_package_settings_id = $1 AND builder_id = $2`,
      [id, builderId],
    );

    if (existingRecord.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "House land package setting not found for this builder.",
      );
    }

    const updateQuery = `
      UPDATE house_land_package_settings
      SET 
        include_facade_cost_in_total = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE house_land_package_settings_id = $3 AND builder_id = $4
      RETURNING house_land_package_settings_id, company_id, builder_id, include_facade_cost_in_total, created_by, updated_by, created_at, updated_at;
    `;

    const values = [include_facade_cost_in_total, userId, id, builderId];

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House land package setting updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating house land package settings:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getHouseLandPackageSettings(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    if (!company_id || !builder_id) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let result = await client.query(
      `
      SELECT *
      FROM house_land_package_settings
      WHERE company_id = $1 AND builder_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [company_id, builder_id],
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `
        INSERT INTO house_land_package_settings (
          company_id,
          builder_id,
          include_facade_cost_in_total,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [company_id, builder_id, false, user_id, user_id],
      );
    }

    return successResponse(
      res,
      {
        houseLandPackageSettings: keysToCamelCase(result.rows[0]),
      },
      "House Land Package Settings fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching house land package settings:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
