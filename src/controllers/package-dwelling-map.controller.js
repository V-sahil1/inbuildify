const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackageDwellingMap = async (req, res) => {
  const builderId = req.user?.builder_id;

  const { package_id, dwelling_type_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pkgCheck = await client.query(
      `SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );
    if (pkgCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid package_id. You can map only your own packages"
      );
    }

    const pkgActiveCheck = await client.query(
      `SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2 AND status = true`,
      [package_id, builderId]
    );
    if (pkgActiveCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Inactive package");
    }

    const dwellingCheck = await client.query(
      `SELECT dwelling_type_id FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2`,
      [dwelling_type_id, builderId]
    );
    if (dwellingCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid dwelling_type_id. You can map only your own dwelling types"
      );
    }

    const dwellingActiveCheck = await client.query(
      `SELECT dwelling_type_id FROM dwelling_type 
       WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_active = true`,
      [dwelling_type_id, builderId]
    );
    if (dwellingActiveCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Inactive dwelling type");
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1 FROM package_dwelling_map
      WHERE package_id = $1 AND dwelling_type_id = $2
      `,
      [package_id, dwelling_type_id]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This package is already mapped with this dwelling type."
      );
    }

    const insertQuery = `
      INSERT INTO package_dwelling_map (package_id, dwelling_type_id)
      VALUES ($1, $2)
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      package_id,
      dwelling_type_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        packageDwellingMap: keysToCamelCase(insertResult.rows[0]),
      },
      "Package dwelling mapping created successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating package_dwelling_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllPackageDwellingMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    const { page = 1, limit = 25 } = req.query;
    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM package_dwelling_map pdm
      JOIN package p ON pdm.package_id = p.package_id
      JOIN dwelling_type dt ON pdm.dwelling_type_id = dt.dwelling_type_id
      WHERE p.builder_id = $1 AND dt.builder_id = $1
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT pdm.*
      FROM package_dwelling_map pdm
      JOIN package p ON pdm.package_id = p.package_id
      JOIN dwelling_type dt ON pdm.dwelling_type_id = dt.dwelling_type_id
      WHERE p.builder_id = $1 AND dt.builder_id = $1
      ORDER BY pdm.id DESC 
      LIMIT $2 OFFSET $3
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    return successResponse(
      res,
      {
        packageDwellingMaps: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Package dwelling mappings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching package_dwelling_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getPackageDwellingMapByPackageId = async (req, res) => {
  const { package_id } = req.params;
  const builderId = req.user?.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const packageCheck = await client.query(
      `SELECT package_id 
       FROM package 
       WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );

    if (packageCheck.rows.length === 0) {
      return errorResponse(
        res,
        403,
        "You cannot access labels for another builder's package"
      );
    }

    const query = `
      SELECT pdm.*, 
             p.builder_id AS package_builder_id
      FROM package_dwelling_map pdm
      JOIN package p ON pdm.package_id = p.package_id
      JOIN dwelling_type dt ON pdm.dwelling_type_id = dt.dwelling_type_id
      WHERE pdm.package_id = $1
    `;

    const result = await client.query(query, [package_id]);

    return successResponse(
      res,
      {
        packageDwellingMaps: keysToCamelCase(result.rows),
      },
      "Package dwelling mappings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching package dwelling map by package_id:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deletePackageDwellingMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT pdm.id
      FROM package_dwelling_map pdm
      JOIN package p ON pdm.package_id = p.package_id
      WHERE pdm.id = $1 AND p.builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [id, builderId]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not allowed to delete this mapping."
      );
    }

    const deleteQuery = `DELETE FROM package_dwelling_map WHERE id = $1`;
    await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      {},
      "package dwelling map deleted successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting package dwelling map:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updatePackageDwellingMap = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user?.builder_id;

  const { package_id, dwelling_type_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const findQuery = `
      SELECT pdm.*,
             p.builder_id AS package_builder_id,
             d.builder_id AS dwelling_builder_id
      FROM package_dwelling_map pdm
      JOIN package p ON pdm.package_id = p.package_id
      JOIN dwelling_type d ON pdm.dwelling_type_id = d.dwelling_type_id
      WHERE pdm.id = $1
    `;

    const findResult = await client.query(findQuery, [id]);

    if (findResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Record not found");
    }

    const record = findResult.rows[0];

    if (
      record.package_builder_id !== builderId ||
      record.dwelling_builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot update records of another builder"
      );
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (package_id) {
      const pkgCheck = await client.query(
        `SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2`,
        [package_id, builderId]
      );

      if (pkgCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid package_id. You can use only your own packages"
        );
      }

      const pkgActiveCheck = await client.query(
        `SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2 AND status = true`,
        [package_id, builderId]
      );

      if (pkgActiveCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive package.");
      }

      fields.push(`package_id = $${index}`);
      values.push(package_id);
      index++;
    }

    if (dwelling_type_id) {
      const dwellingCheck = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type WHERE dwelling_type_id = $1 AND builder_id = $2 AND is_active = true`,
        [dwelling_type_id, builderId]
      );

      if (dwellingCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive dwelling type.");
      }

      fields.push(`dwelling_type_id = $${index}`);
      values.push(dwelling_type_id);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    if (package_id || dwelling_type_id) {
      const newPackageId = package_id || record.package_id;
      const newDwellingId = dwelling_type_id || record.dwelling_type_id;

      const duplicateCheck = await client.query(
        `
        SELECT 1 FROM package_dwelling_map
        WHERE package_id = $1 
        AND dwelling_type_id = $2
        AND id <> $3
        `,
        [newPackageId, newDwellingId, id]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "This package is already mapped with this dwelling type."
        );
      }
    }

    values.push(id);

    const updateQuery = `
      UPDATE package_dwelling_map
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        package: keysToCamelCase(updateResult.rows[0]),
      },
      "Package dwelling map updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating package_dwelling_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
