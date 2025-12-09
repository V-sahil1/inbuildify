const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackageLabelMap = async (req, res) => {
  const builderId = req.user?.builder_id;

  const { package_id, range_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pkgCheck = await client.query(
      `
      SELECT package_id 
      FROM package 
      WHERE package_id = $1 AND builder_id = $2
      `,
      [package_id, builderId]
    );

    if (pkgCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid package_id. You can use only your own packages."
      );
    }

    const pkgActiveCheck = await client.query(
      `
      SELECT package_id 
      FROM package 
      WHERE package_id = $1 AND builder_id = $2 AND status = true
      `,
      [package_id, builderId]
    );

    if (pkgActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Inactive package");
    }

    const rangeCheck = await client.query(
      `
      SELECT range_id 
      FROM range 
      WHERE range_id = $1 AND builder_id = $2
      `,
      [range_id, builderId]
    );

    if (rangeCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid range_id. You can use only your own ranges."
      );
    }

    const rangeActiveCheck = await client.query(
      `
      SELECT range_id 
      FROM range 
      WHERE range_id = $1 AND builder_id = $2 AND is_active = true
      `,
      [range_id, builderId]
    );

    if (rangeActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Inactive range range");
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1 FROM package_label_map
      WHERE package_id = $1 AND range_id = $2
      `,
      [package_id, range_id]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This package is already mapped with this range."
      );
    }

    const insertQuery = `
      INSERT INTO package_label_map (package_id, range_id)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [package_id, range_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        package: keysToCamelCase(result.rows[0]),
      },
      "Package label mapped successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating package_label_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllPackageLabelMap = async (req, res) => {
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
      FROM package_label_map plm
      JOIN package p ON plm.package_id = p.package_id
      JOIN range r ON plm.range_id = r.range_id
      WHERE p.builder_id = $1 AND r.builder_id = $1
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT plm.*
      FROM package_label_map plm
      JOIN package p ON plm.package_id = p.package_id
      JOIN range r ON plm.range_id = r.range_id
      WHERE p.builder_id = $1 AND r.builder_id = $1
      ORDER BY plm.id DESC 
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
        packageLabelMaps: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Package label mappings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching package_label_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getPackageLabelMapByPackageId = async (req, res) => {
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
      SELECT plm.*, 
             p.builder_id AS package_builder_id
      FROM package_label_map plm
      JOIN package p ON plm.package_id = p.package_id
      JOIN range r ON plm.range_id = r.range_id
      WHERE plm.package_id = $1
    `;

    const result = await client.query(query, [package_id]);

    return successResponse(
      res,
      {
        packageLabelMaps: keysToCamelCase(result.rows),
      },
      "Package label mappings fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching package_label_map by package_id:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deletePackageLabelMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT plm.id
      FROM package_label_map plm
      JOIN package p ON plm.package_id = p.package_id
      WHERE plm.id = $1 AND p.builder_id = $2
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

    const deleteQuery = `DELETE FROM package_label_map WHERE id = $1`;
    await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    return successResponse(res, {}, "package label map deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting package group map:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updatePackageLabelMap = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user?.builder_id;

  const { package_id, range_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const findQuery = `
      SELECT plm.*, 
             p.builder_id AS package_builder_id,
             r.builder_id AS range_builder_id
      FROM package_label_map plm
      JOIN package p ON plm.package_id = p.package_id
      JOIN range r ON plm.range_id = r.range_id
      WHERE plm.id = $1
    `;
    const findResult = await client.query(findQuery, [id]);

    if (findResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "package label map not found");
    }

    const record = findResult.rows[0];

    if (
      record.package_builder_id !== builderId ||
      record.range_builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot update  package label map of another builder"
      );
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (package_id) {
      const packageCheck = await client.query(
        `SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2`,
        [package_id, builderId]
      );
      if (packageCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid package_id. You can use only your own packages"
        );
      }

      const packageActiveCheck = await client.query(
        `SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2 AND status = true`,
        [package_id, builderId]
      );
      if (packageActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive package.");
      }

      fields.push(`package_id = $${index}`);
      values.push(package_id);
      index++;
    }

    if (range_id) {
      const rangeCheck = await client.query(
        `SELECT range_id FROM range WHERE range_id = $1 AND builder_id = $2`,
        [range_id, builderId]
      );
      if (rangeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid range_id. You can use only your own ranges"
        );
      }

      const rangeActiveCheck = await client.query(
        `SELECT range_id FROM range WHERE range_id = $1 AND builder_id = $2 AND is_active = true`,
        [range_id, builderId]
      );
      if (rangeActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid range.");
      }

      fields.push(`range_id = $${index}`);
      values.push(range_id);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    if (package_id || range_id) {
      const newPackageId = package_id || record.package_id;
      const newRangeId = range_id || record.range_id;

      const duplicateCheck = await client.query(
        `
        SELECT 1 FROM package_label_map
        WHERE package_id = $1 AND range_id = $2 AND id != $3
        `,
        [newPackageId, newRangeId, id]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "This package is already mapped with this range."
        );
      }
    }

    values.push(id);

    const updateQuery = `
      UPDATE package_label_map
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
      "Package updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating package_label_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
