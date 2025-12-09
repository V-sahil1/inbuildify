const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackageGroupMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const { package_id, package_group_id } = req.body;

    if (!package_id || !package_group_id) {
      return errorResponse(
        res,
        400,
        "package_id and package_group_id are required."
      );
    }

    await client.query("BEGIN");

    const packageCheck = await client.query(
      `
      SELECT package_id FROM package
      WHERE package_id = $1 
        AND builder_id = $2 
        AND company_id = $3
      `,
      [package_id, builderId, companyId]
    );

    if (packageCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Invalid package_id. You can map only your own packages."
      );
    }

    const packageActiveCheck = await client.query(
      `
      SELECT package_id FROM package
      WHERE package_id = $1 
        AND builder_id = $2 
        AND company_id = $3
        And status = true
      `,
      [package_id, builderId, companyId]
    );

    if (packageActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "inactive package.");
    }

    const groupCheck = await client.query(
      `
      SELECT package_group_id FROM package_group
      WHERE package_group_id = $1 
        AND builder_id = $2
        AND company_id = $3
      `,
      [package_group_id, builderId, companyId]
    );

    if (groupCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "Invalid package_group_id. You can map only your own package groups."
      );
    }

    const groupActiveCheck = await client.query(
      `
      SELECT package_group_id FROM package_group
      WHERE package_group_id = $1 
        AND builder_id = $2
        AND company_id = $3
        AND is_active = true
      `,
      [package_group_id, builderId, companyId]
    );

    if (groupActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "Inactive package group..");
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1 FROM package_group_map
      WHERE package_id = $1 AND package_group_id = $2
      `,
      [package_id, package_group_id]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This package is already mapped with this package group."
      );
    }

    const insertQuery = `
      INSERT INTO package_group_map (package_id, package_group_id)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const insertResult = await client.query(insertQuery, [
      package_id,
      package_group_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Package successfully mapped to package group."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createPackageGroupMap error:", err);
    return errorResponse(res, 500, err.message);
  } finally {
    client.release();
  }
};

exports.getAllPackageGroupMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
        pgm.id,
        pgm.package_id,
        pgm.package_group_id
      FROM package_group_map pgm
      INNER JOIN package p 
        ON pgm.package_id = p.package_id
      INNER JOIN package_group pg 
        ON pgm.package_group_id = pg.package_group_id
      WHERE p.builder_id = $1 
        AND p.company_id = $2
      ORDER BY pgm.id DESC
      LIMIT $3 OFFSET $4;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      companyId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM package_group_map pgm
      INNER JOIN package p 
        ON pgm.package_id = p.package_id
      WHERE p.builder_id = $1 AND p.company_id = $2;
    `;

    const countResult = await client.query(countQuery, [builderId, companyId]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        packageGroupMaps: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Package group mappings fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching package group mappings:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPackageGroupMapByPackageId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { package_id } = req.params;

    if (!package_id) {
      return errorResponse(res, 400, "package_id is required.");
    }

    const pkgCheck = await client.query(
      `
      SELECT package_id 
      FROM package
      WHERE package_id = $1 
        AND builder_id = $2
        AND company_id = $3
      `,
      [package_id, builderId, companyId]
    );

    if (pkgCheck.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Package not found or not owned by this builder."
      );
    }

    const mappingQuery = `
      SELECT 
        pgm.id,
        pgm.package_group_id
      FROM package_group_map pgm
      INNER JOIN package_group pg 
        ON pgm.package_group_id = pg.package_group_id
      WHERE pgm.package_id = $1
      ORDER BY pg.name ASC;
    `;

    const result = await client.query(mappingQuery, [package_id]);

    return successResponse(
      res,
      {
        packageId: package_id,
        mappedGroups: keysToCamelCase(result.rows),
      },
      "Package group mapping fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching package group map:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deletePackageGroupMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "package_group_map id is required.",
      });
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT pgm.id
      FROM package_group_map pgm
      JOIN package p ON pgm.package_id = p.package_id
      WHERE pgm.id = $1 AND p.builder_id = $2
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

    const deleteQuery = `DELETE FROM package_group_map WHERE id = $1`;
    await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    return successResponse(res, {}, "package group map deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting package group map:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error.",
    });
  } finally {
    client.release();
  }
};

exports.updatePackageGroupMap = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user?.builder_id;

  const { package_id, package_group_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const findQuery = `
      SELECT pgm.*, 
             p.builder_id AS package_builder_id, 
             pg.builder_id AS group_builder_id
      FROM package_group_map pgm
      JOIN package p ON pgm.package_id = p.package_id
      JOIN package_group pg ON pgm.package_group_id = pg.package_group_id
      WHERE pgm.id = $1
    `;
    const findResult = await client.query(findQuery, [id]);

    if (findResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Record not found");
    }

    const record = findResult.rows[0];

    if (
      record.package_builder_id !== builderId ||
      record.group_builder_id !== builderId
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
        return errorResponse(res, 400, "Inactive package");
      }

      fields.push(`package_id = $${index}`);
      values.push(package_id);
      index++;
    }

    if (package_group_id) {
      const groupCheck = await client.query(
        `SELECT package_group_id FROM package_group WHERE package_group_id = $1 AND builder_id = $2`,
        [package_group_id, builderId]
      );
      if (groupCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid package_group_id. You can use only your own package groups"
        );
      }

      const groupActiveCheck = await client.query(
        `SELECT package_group_id FROM package_group WHERE package_group_id = $1 AND builder_id = $2 AND is_active = true`,
        [package_group_id, builderId]
      );
      if (groupActiveCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive package group");
      }

      fields.push(`package_group_id = $${index}`);
      values.push(package_group_id);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    if (package_id || package_group_id) {
      const newPackageId = package_id || record.package_id;
      const newGroupId = package_group_id || record.package_group_id;

      const duplicateCheck = await client.query(
        `
        SELECT 1 FROM package_group_map
        WHERE package_id = $1 AND package_group_id = $2 
          AND id <> $3
        `,
        [newPackageId, newGroupId, id]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "This package is already mapped with this package group."
        );
      }
    }

    values.push(id);

    const updateQuery = `
      UPDATE package_group_map 
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
    console.error("Error updating package_group_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
