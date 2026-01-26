const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackageGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized. Builder or Company required.",
      );
    }

    const { name, no_of_packages } = req.body;

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Package group name is required.");
    }

    const duplicateCheck = await client.query(
      `SELECT package_group_id 
       FROM package_group 
       WHERE LOWER(name) = LOWER($1) 
       AND (company_id = $2 OR builder_id = $3)`,
      [name.trim(), companyId, builderId],
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Package group with this name already exists.",
      );
    }

    const insertQuery = `
      INSERT INTO package_group (
        company_id,
        builder_id,
        name,
        no_of_packages,
        created_at,
        updated_at
      ) VALUES ($1,$2,$3,$4,NOW(),NOW())
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      Number(no_of_packages) || 0,
    ];

    const result = await client.query(insertQuery, values);

    const packageGroup = keysToCamelCase(result.rows[0]);
    const response = {
      packageGroupId: packageGroup.packageGroupId,
      companyId: packageGroup.companyId,
      builderId: packageGroup.builderId,
      name: packageGroup.name,
      noOfPackages: packageGroup.noOfPackages,
      createdAt: packageGroup.createdAt,
      updatedAt: packageGroup.updatedAt,
    };

    return successResponse(res, response, "Package group created successfully");
  } catch (error) {
    console.error("createPackageGroup error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.getAllPackageGroups = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized. Builder or Company required.",
      );
    }

    let { page = 1, limit = 25 } = req.query;

    page = isNaN(parseInt(page)) ? 1 : parseInt(page);
    limit = isNaN(parseInt(limit)) ? 25 : parseInt(limit);

    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM package_group
      WHERE (company_id = $1 OR builder_id = $2)
    `;

    const countResult = await client.query(countQuery, [companyId, builderId]);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        pg.*
      FROM package_group pg
      WHERE (pg.company_id = $1 OR pg.builder_id = $2)
      ORDER BY pg.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const dataResult = await client.query(dataQuery, [
      companyId,
      builderId,
      limit,
      offset,
    ]);

    // Format the response
    const formattedPackageGroups = dataResult.rows.map((row) => {
      const pg = keysToCamelCase(row);

      return {
        packageGroupId: pg.packageGroupId,
        companyId: pg.companyId,
        builderId: pg.builderId,
        name: pg.name,
        noOfPackages: pg.noOfPackages,
        createdAt: pg.createdAt,
        updatedAt: pg.updatedAt,
      };
    });

    return successResponse(
      res,
      {
        packageGroups: formattedPackageGroups,
        total,
        page,
        totalPages,
        limit,
      },
      "Package groups fetched successfully",
    );
  } catch (error) {
    console.error("getAllPackageGroups error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.deletePackageGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_group_id } = req.params;
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    if (!package_group_id) {
      return errorResponse(res, 400, "Package Group ID is required.");
    }

    const checkQuery = `
      SELECT package_group_id 
      FROM package_group
      WHERE package_group_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      package_group_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Package group not found or you don't have permission to delete it.",
      );
    }

    const deleteQuery = `
      DELETE FROM package_group
      WHERE package_group_id = $1
    `;

    await client.query(deleteQuery, [package_group_id]);

    return successResponse(res, {}, "Package group deleted successfully.");
  } catch (error) {
    console.error("deletePackageGroup error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.updatePackageGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_group_id } = req.params;
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const { name, no_of_packages } = req.body;

    if (!package_group_id) {
      return errorResponse(res, 400, "Package Group ID is required.");
    }

    await client.query("BEGIN");

    const findQuery = `
      SELECT * FROM package_group
      WHERE package_group_id = $1
        AND (company_id = $2 OR builder_id = $3)
      FOR UPDATE
    `;
    const findResult = await client.query(findQuery, [
      package_group_id,
      companyId,
      builderId,
    ]);

    if (findResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Package group not found or you don't have permission to update it.",
      );
    }

    const existing = findResult.rows[0];

    const fieldsToCheck = ["name", "no_of_packages"];
    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    if (name) {
      const duplicateCheck = await client.query(
        `
        SELECT 1 FROM package_group
        WHERE LOWER(name) = LOWER($1)
          AND (company_id = $2 OR builder_id = $3)
          AND package_group_id <> $4
        `,
        [name.trim(), companyId, builderId, package_group_id],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Package group name already exists.");
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(name.trim());
    }
    if (no_of_packages !== undefined) {
      fields.push(`no_of_packages = $${index++}`);
      values.push(no_of_packages);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update.");
    }

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE package_group
      SET ${fields.join(", ")}
      WHERE package_group_id = $${index}
      RETURNING *;
    `;

    values.push(package_group_id);

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    const updatedPackageGroup = keysToCamelCase(updateResult.rows[0]);

    const response = {
      packageGroupId: updatedPackageGroup.packageGroupId,
      companyId: updatedPackageGroup.companyId,
      builderId: updatedPackageGroup.builderId,
      name: updatedPackageGroup.name,
      noOfPackages: updatedPackageGroup.noOfPackages,
      createdAt: updatedPackageGroup.createdAt,
      updatedAt: updatedPackageGroup.updatedAt,
    };

    return successResponse(
      res,
      response,
      "Package group updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("updatePackageGroup error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};
