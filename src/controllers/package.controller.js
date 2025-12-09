const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      name,
      cost,
      builder_cost,
      sort_order,
      status,
      allow_add_item_from_pricelist,
      allow_remove_package_items,
    } = req.body || {};

    const duplicateNameQuery = `
      SELECT package_id FROM package
      WHERE company_id = $1
      AND builder_id = $2
      AND LOWER(name) = $3
    `;

    const duplicateNameResult = await client.query(duplicateNameQuery, [
      companyId,
      builderId,
      name.toLowerCase().trim(),
    ]);

    if (duplicateNameResult.rowCount > 0) {
      return errorResponse(res, 409, "Package name already exists.");
    }

    const finalSortOrder = sort_order ?? 0;

    const duplicateSortQuery = `
      SELECT package_id FROM package
      WHERE company_id = $1
      AND builder_id = $2
      AND sort_order = $3
    `;

    const duplicateSortResult = await client.query(duplicateSortQuery, [
      companyId,
      builderId,
      finalSortOrder,
    ]);

    if (duplicateSortResult.rowCount > 0) {
      return errorResponse(
        res,
        400,
        `Sort order ${finalSortOrder} already exists.`
      );
    }

    const insertQuery = `
      INSERT INTO package (
        company_id,
        builder_id,
        name,
        cost,
        builder_cost,
        sort_order,
        status,
        allow_add_item_from_pricelist,
        allow_remove_package_items,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      cost ?? null,
      builder_cost ?? null,
      finalSortOrder,
      status ?? true,
      allow_add_item_from_pricelist ?? false,
      allow_remove_package_items ?? true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Package created successfully."
    );
  } catch (error) {
    console.error("Create Package Error:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Package name or sort order already exists."
      );
    }

    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllPackages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limitValue =
      Number(req.query.limit) > 0 ? Number(req.query.limit) : 25;
    const offset = (page - 1) * limitValue;

    const { name, cost, status, sort_order } = req.query;

    const conditions = [];
    const values = [];
    let i = 1;

    conditions.push(`builder_id = $${i}`);
    values.push(builderId);
    i++;

    if (name !== undefined && name.trim() !== "") {
      conditions.push(`LOWER(name) LIKE LOWER($${i})`);
      values.push(`%${name.trim()}%`);
      i++;
    }

    if (cost !== undefined && cost !== "") {
      const numCost = Number(cost);
      if (isNaN(numCost)) {
        return errorResponse(res, 400, "cost must be a valid number");
      }
      conditions.push(`cost = $${i}`);
      values.push(numCost);
      i++;
    }

    if (status !== undefined && status !== "") {
      if (!["true", "false"].includes(status)) {
        return errorResponse(res, 400, "status must be true or false");
      }
      conditions.push(`status = $${i}`);
      values.push(status === "true");
      i++;
    }

    let orderBy = "ORDER BY created_at ASC";
    if (sort_order) {
      if (!["asc", "desc"].includes(sort_order.toLowerCase())) {
        return errorResponse(res, 400, "sort_direction must be ASC or DESC");
      }
      orderBy = `ORDER BY sort_order ${sort_order.toUpperCase()}`;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM package
      ${whereClause};
    `;

    const countResult = await client.query(countQuery, values);
    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitValue);

    const fetchQuery = `
      SELECT *
      FROM package
      ${whereClause}
      ${orderBy}
      LIMIT ${limitValue} OFFSET ${offset};
    `;

    const packagesResult = await client.query(fetchQuery, values);

    return successResponse(res, "Packages fetched successfully", {
      package: packagesResult.rows,
      trcords: total,
      currentPage: page,
      totalPages,
      limit: limitValue,
    });
  } catch (error) {
    console.error("getAllPackages error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.deletePackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_id } = req.params;
    const builderId = req.user.builder_id;

    const check = await client.query(
      `SELECT 1 FROM package WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );
    if (check.rowCount === 0) {
      return errorResponse(res, 404, "Package not found");
    }

    await client.query(
      `DELETE FROM package WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId]
    );

    return successResponse(res, null, "Package deleted successfully.");
  } catch (err) {
    console.error("Error deleting package:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updatePackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;
    const { package_id } = req.params;

    if (!package_id) {
      return errorResponse(res, 400, "package_id is required.");
    }

    const {
      name,
      cost,
      builder_cost,
      sort_order,
      status, // This field takes the logic of 'is_active'
      allow_add_item_from_pricelist,
      allow_remove_package_items,
    } = req.body;

    await client.query("BEGIN");

    // Check if package exists and belongs to builder, and LOCK THE ROW FOR UPDATE
    const existingRes = await client.query(
      `SELECT * FROM package WHERE package_id = $1 AND builder_id = $2 FOR UPDATE`,
      [package_id, builderId]
    );

    if (existingRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Package not found or access denied.");
    }

    const existing = existingRes.rows[0];

    const currentStatus = existing.status;
    const statusInBody = status !== undefined;
    const requestedStatus = status;

    const fieldsToCheck = [
      "name",
      "cost",
      "builder_cost",
      "sort_order",
      "allow_add_item_from_pricelist",
      "allow_remove_package_items",
    ];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
    }

    let effectiveRequestedStatus = requestedStatus;
    if (statusInBody && typeof requestedStatus === "string") {
      effectiveRequestedStatus = requestedStatus.toLowerCase() === "true";
    }

    if (
      currentStatus === true &&
      statusInBody &&
      effectiveRequestedStatus === false
    ) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active package, 'status' must be the only field provided in the request."
        );
      }
    }

    if (currentStatus === false) {
      if (statusInBody && effectiveRequestedStatus === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive package, 'status' must be the only field provided in the request."
          );
        }
      }

      const performingActivation =
        statusInBody && effectiveRequestedStatus === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'status' fields when the package is currently Inactive. Only 'status' can be changed (to true/Active)."
        );
      }

      if (statusInBody && effectiveRequestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Package is already Inactive. 'status' can only be updated to true (Active) from this state."
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    const addField = (field, value, type = "any") => {
      if (value !== undefined) {
        if (type === "number") {
          const numVal = Number(value);
          if (isNaN(numVal)) {
            throw new Error(`${field} must be a valid number`);
          }
          fields.push(`${field} = $${i}`);
          values.push(numVal);
        } else if (type === "boolean") {
          if (typeof value !== "boolean") {
            if (value === "true" || value === "false") {
              fields.push(`${field} = $${i}`);
              values.push(value === "true");
            } else {
              throw new Error(`${field} must be true or false`);
            }
          } else {
            fields.push(`${field} = $${i}`);
            values.push(value);
          }
        } else if (type === "string") {
          fields.push(`${field} = $${i}`);
          values.push(value.trim());
        } else {
          fields.push(`${field} = $${i}`);
          values.push(value);
        }
        i++;
      }
    };

    addField("name", name, "string");
    addField("cost", cost, "number");
    addField("builder_cost", builder_cost, "number");
    addField("sort_order", sort_order, "number");
    addField("status", status, "boolean");
    addField(
      "allow_add_item_from_pricelist",
      allow_add_item_from_pricelist,
      "boolean"
    );
    addField(
      "allow_remove_package_items",
      allow_remove_package_items,
      "boolean"
    );

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update."
      );
    }

    if (name) {
      const duplicateNameCheck = await client.query(
        `SELECT package_id FROM package 
          WHERE LOWER(name) = LOWER($1) 
          AND builder_id = $2 
          AND company_id = $3
          AND package_id != $4`,
        [name.trim(), builderId, companyId, package_id]
      );
      if (duplicateNameCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 409, "Package name already exists.");
      }
    }

    if (sort_order !== undefined) {
      const duplicateSortCheck = await client.query(
        `SELECT package_id FROM package 
          WHERE sort_order = $1
          AND builder_id = $2
          AND company_id = $3
          AND package_id != $4`,
        [Number(sort_order), builderId, companyId, package_id]
      );
      if (duplicateSortCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          `Sort order ${sort_order} already exists.`
        );
      }
    }

    fields.push(`updated_by = $${i}`);
    values.push(userId);
    i++;

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE package
      SET ${fields.join(", ")}
      WHERE package_id = $${i} AND builder_id = $${i + 1}
      RETURNING *;
    `;
    values.push(package_id, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        package: keysToCamelCase(result.rows[0]),
      },
      "Package updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("updatePackage error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
