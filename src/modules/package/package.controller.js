import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createPackage(req, res) {
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
      range_id,
      dwelling_type_id,
      package_group_id,
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

    if (range_id) {
      const rangeIdsArray = Array.isArray(range_id) ? range_id : [range_id];

      for (const id of rangeIdsArray) {
        if (id) {
          const rangeCheck = await client.query(
            "SELECT 1 FROM range WHERE range_id = $1 AND is_active = true AND builder_id = $2",
            [id, builderId],
          );

          if (rangeCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid range ID: ${id}. Range does not exist or is not active.`,
            );
          }
        }
      }
    }

    if (dwelling_type_id) {
      const dwellingTypeIdsArray = Array.isArray(dwelling_type_id)
        ? dwelling_type_id
        : [dwelling_type_id];

      for (const id of dwellingTypeIdsArray) {
        if (id) {
          const dwellingTypeCheck = await client.query(
            "SELECT 1 FROM dwelling_type WHERE dwelling_type_id = $1 AND is_active = true AND builder_id = $2",
            [id, builderId],
          );

          if (dwellingTypeCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid dwelling type ID: ${id}. Dwelling type does not exist or is not active.`,
            );
          }
        }
      }
    }

    if (package_group_id) {
      const packageGroupIdsArray = Array.isArray(package_group_id)
        ? package_group_id
        : [package_group_id];

      for (const id of packageGroupIdsArray) {
        if (id) {
          const packageGroupCheck = await client.query(
            "SELECT 1 FROM package_group WHERE package_group_id = $1 AND (company_id = $2 OR builder_id = $3)",
            [id, companyId, builderId],
          );

          if (packageGroupCheck.rowCount === 0) {
            return errorResponse(
              res,
              400,
              `Invalid package group ID: ${id}. Package group does not exist or does not belong to your organization.`,
            );
          }
        }
      }
    }

    const finalSortOrder = sort_order ?? 0;

    const duplicateSortQuery = `
      SELECT package_id FROM package
      WHERE company_id = $1
      AND builder_id = $2
      AND sort_order = $3
    `;

    await client.query(
      `UPDATE package
       SET sort_order = sort_order + 1
       WHERE company_id = $1 AND builder_id = $2 AND sort_order >= $3`,
      [companyId, builderId, finalSortOrder],
    );

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
        range_id,
        dwelling_type_id,
        package_group_id,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
      range_id || null,
      dwelling_type_id || null,
      package_group_id || null,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    const getCreatedPackageQuery = `
      SELECT 
        p.*,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', r.range_id,
              'name', r.name
            )
          )
          FROM range r
          WHERE r.range_id = ANY(p.range_id) AND r.is_active = true
        ) as range_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          )
          FROM dwelling_type dt
          WHERE dt.dwelling_type_id = ANY(p.dwelling_type_id) AND dt.is_active = true
        ) as dwelling_type_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', pg.package_group_id,
              'name', pg.name
            )
          )
          FROM package_group pg
          WHERE pg.package_group_id = ANY(p.package_group_id)
        ) as package_group_data
      FROM package p
      WHERE p.package_id = $1
    `;

    const createdPackageResult = await client.query(getCreatedPackageQuery, [
      result.rows[0].package_id,
    ]);
    const createdPackage = keysToCamelCase(createdPackageResult.rows[0]);

    const formattedPackage = {
      packageId: createdPackage.packageId,
      companyId: createdPackage.companyId,
      builderId: createdPackage.builderId,
      name: createdPackage.name,
      cost: createdPackage.cost ? createdPackage.cost.toString() : null,
      builderCost: createdPackage.builderCost
        ? createdPackage.builderCost.toString()
        : null,
      sortOrder: createdPackage.sortOrder,
      status: createdPackage.status,
      allowAddItemFromPricelist: createdPackage.allowAddItemFromPricelist,
      allowRemovePackageItems: createdPackage.allowRemovePackageItems,
      range: createdPackage.rangeData || [],
      dwellingType: createdPackage.dwellingTypeData || [],
      packageGroup: createdPackage.packageGroupData || [],
      createdBy: createdPackage.createdBy,
      updatedBy: createdPackage.updatedBy,
      createdAt: createdPackage.createdAt,
      updatedAt: createdPackage.updatedAt,
    };

    return successResponse(
      res,
      formattedPackage,
      "Package created successfully.",
    );
  } catch (error) {
    console.error("Create Package Error:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Package name or sort order already exists.",
      );
    }

    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function getAllPackages(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limitValue =
      Number(req.query.limit) > 0 ? Number(req.query.limit) : 25;
    const offset = (page - 1) * limitValue;

    const {
      name,
      cost,
      status,
      sort_order,
      dwelling_type_id,
      range_id,
      add,
      remove,
    } = req.query;

    const conditions = [];
    const values = [];
    let i = 1;

    conditions.push(`p.builder_id = $${i}`);
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
    if (dwelling_type_id !== undefined && dwelling_type_id !== "") {
      conditions.push(`$${i} = ANY(p.dwelling_type_id)`);
      values.push(dwelling_type_id);
      i++;
    }

    if (range_id !== undefined && range_id !== "") {
      conditions.push(`$${i} = ANY(p.range_id)`);
      values.push(range_id);
      i++;
    }

    if (add !== undefined && add !== "") {
      if (!["true", "false"].includes(add)) {
        return errorResponse(
          res,
          400,
          "allow_add_item_from_pricelist must be true or false",
        );
      }
      conditions.push(`allow_add_item_from_pricelist = $${i}`);
      values.push(add === "true");
      i++;
    }

    if (remove !== undefined && remove !== "") {
      if (!["true", "false"].includes(remove)) {
        return errorResponse(
          res,
          400,
          "allow_remove_package_items must be true or false",
        );
      }
      conditions.push(`allow_remove_package_items = $${i}`);
      values.push(remove === "true");
      i++;
    }

    if (sort_order !== undefined && sort_order !== "") {
      const sortValue = Number(sort_order);
      if (isNaN(sortValue)) {
        return errorResponse(res, 400, "sort_order must be a valid number");
      }
      conditions.push(`sort_order = $${i}`);
      values.push(sortValue);
      i++;
    }

    const orderBy = "ORDER BY sort_order ASC";

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM package p
      ${whereClause};
    `;

    const countResult = await client.query(countQuery, values);
    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitValue);

    const fetchQuery = `
      SELECT 
        p.*,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', r.range_id,
              'name', r.name
            )
          )
          FROM range r
          WHERE r.range_id = ANY(p.range_id) AND r.is_active = true
        ) as range_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          )
          FROM dwelling_type dt
          WHERE dt.dwelling_type_id = ANY(p.dwelling_type_id) AND dt.is_active = true
        ) as dwelling_type_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', pg.package_group_id,
              'name', pg.name
            )
          )
          FROM package_group pg
          WHERE pg.package_group_id = ANY(p.package_group_id)
        ) as package_group_data
      FROM package p
      ${whereClause}
      ${orderBy}
      LIMIT ${limitValue} OFFSET ${offset};
    `;

    const packagesResult = await client.query(fetchQuery, values);

    const formattedPackages = packagesResult.rows.map((row) => {
      const pkg = keysToCamelCase(row);
      return {
        packageId: pkg.packageId,
        companyId: pkg.companyId,
        builderId: pkg.builderId,
        name: pkg.name,
        cost: pkg.cost ? pkg.cost.toString() : null,
        builderCost: pkg.builderCost ? pkg.builderCost.toString() : null,
        sortOrder: pkg.sortOrder,
        status: pkg.status,
        allowAddItemFromPricelist: pkg.allowAddItemFromPricelist,
        allowRemovePackageItems: pkg.allowRemovePackageItems,
        packageGroup: pkg.packageGroupData || [],
        range: pkg.rangeData || [],
        dwellingType: pkg.dwellingTypeData || [],
        createdBy: pkg.createdBy,
        updatedBy: pkg.updatedBy,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      };
    });

    return successResponse(
      res,
      {
        package: formattedPackages,
        pagination: {
          totalRecords: total,
          currentPage: page,
          totalPages,
          limit: limitValue,
        },
      },
      "Packages fetched successfully.",
    );
  } catch (error) {
    console.error("getAllPackages error:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
}

export async function deletePackage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { package_id } = req.params;
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const check = await client.query(
      "SELECT sort_order FROM package WHERE package_id = $1 AND builder_id = $2",
      [package_id, builderId],
    );
    if (check.rowCount === 0) {
      return errorResponse(res, 404, "Package not found");
    }

    const deletedSortOrder = check.rows[0].sort_order;

    await client.query(
      "DELETE FROM package WHERE package_id = $1 AND builder_id = $2",
      [package_id, builderId],
    );

    await client.query(
      `UPDATE package 
       SET sort_order = sort_order - 1 
       WHERE company_id = $1 AND builder_id = $2 AND sort_order > $3`,
      [companyId, builderId, deletedSortOrder],
    );

    return successResponse(res, null, "Package deleted successfully.");
  } catch (err) {
    console.error("Error deleting package:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updatePackage(req, res) {
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
      status,
      allow_add_item_from_pricelist,
      allow_remove_package_items,
      range_id,
      dwelling_type_id,
      package_group_id,
    } = req.body;

    await client.query("BEGIN");

    const existingRes = await client.query(
      "SELECT * FROM package WHERE package_id = $1 AND builder_id = $2 FOR UPDATE",
      [package_id, builderId],
    );

    if (existingRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Package not found or access denied.");
    }

    const existing = existingRes.rows[0];

    if (range_id) {
      const rangeIdsArray = Array.isArray(range_id) ? range_id : [range_id];

      for (const id of rangeIdsArray) {
        if (id) {
          const rangeCheck = await client.query(
            "SELECT 1 FROM range WHERE range_id = $1 AND is_active = true AND builder_id = $2",
            [id, builderId],
          );

          if (rangeCheck.rowCount === 0) {
            await client.query("ROLLBACK");
            return errorResponse(
              res,
              400,
              `Invalid range ID: ${id}. Range does not exist or is not active.`,
            );
          }
        }
      }
    }

    if (dwelling_type_id) {
      const dwellingTypeIdsArray = Array.isArray(dwelling_type_id)
        ? dwelling_type_id
        : [dwelling_type_id];

      for (const id of dwellingTypeIdsArray) {
        if (id) {
          const dwellingTypeCheck = await client.query(
            "SELECT 1 FROM dwelling_type WHERE dwelling_type_id = $1 AND is_active = true AND builder_id = $2",
            [id, builderId],
          );

          if (dwellingTypeCheck.rowCount === 0) {
            await client.query("ROLLBACK");
            return errorResponse(
              res,
              400,
              `Invalid dwelling type ID: ${id}. Dwelling type does not exist or is not active.`,
            );
          }
        }
      }
    }

    if (package_group_id) {
      const packageGroupIdsArray = Array.isArray(package_group_id)
        ? package_group_id
        : [package_group_id];

      for (const id of packageGroupIdsArray) {
        if (id) {
          const packageGroupCheck = await client.query(
            "SELECT 1 FROM package_group WHERE package_group_id = $1 AND (company_id = $2 OR builder_id = $3)",
            [id, companyId, builderId],
          );

          if (packageGroupCheck.rowCount === 0) {
            await client.query("ROLLBACK");
            return errorResponse(
              res,
              400,
              `Invalid package group ID: ${id}. Package group does not exist or does not belong to your organization.`,
            );
          }
        }
      }
    }

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
      "range_id",
      "dwelling_type_id",
      "package_group_id",
    ];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    let effectiveRequestedStatus = requestedStatus;
    if (statusInBody && typeof requestedStatus === "string") {
      effectiveRequestedStatus = requestedStatus.toLowerCase() === "true";
    }

    if (sort_order !== undefined && sort_order !== existing.sort_order) {
      const newSortOrder = Number(sort_order);
      const oldSortOrder = existing.sort_order;

      if (newSortOrder > oldSortOrder) {
        await client.query(
          `UPDATE package
           SET sort_order = sort_order - 1
           WHERE company_id = $1 AND builder_id = $2 
           AND sort_order > $3 AND sort_order <= $4`,
          [companyId, builderId, oldSortOrder, newSortOrder],
        );
      } else if (newSortOrder < oldSortOrder) {
        await client.query(
          `UPDATE package
           SET sort_order = sort_order + 1
           WHERE company_id = $1 AND builder_id = $2 
           AND sort_order >= $3 AND sort_order < $4`,
          [companyId, builderId, newSortOrder, oldSortOrder],
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
      "boolean",
    );
    addField(
      "allow_remove_package_items",
      allow_remove_package_items,
      "boolean",
    );
    if (range_id !== undefined) {
      addField("range_id", range_id);
    }
    if (dwelling_type_id !== undefined) {
      addField("dwelling_type_id", dwelling_type_id);
    }
    if (package_group_id !== undefined) {
      addField("package_group_id", package_group_id);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    if (name) {
      const duplicateNameCheck = await client.query(
        `SELECT package_id FROM package 
          WHERE LOWER(name) = LOWER($1) 
          AND builder_id = $2 
          AND company_id = $3
          AND package_id != $4`,
        [name.trim(), builderId, companyId, package_id],
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
        [Number(sort_order), builderId, companyId, package_id],
      );
      if (duplicateSortCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          `Sort order ${sort_order} already exists.`,
        );
      }
    }

    fields.push(`updated_by = $${i}`);
    values.push(userId);
    i++;

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE package
      SET ${fields.join(", ")}
      WHERE package_id = $${i} AND builder_id = $${i + 1}
      RETURNING *;
    `;
    values.push(package_id, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    const getUpdatedPackageQuery = `
      SELECT 
        p.*,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', r.range_id,
              'name', r.name
            )
          )
          FROM range r
          WHERE r.range_id = ANY(p.range_id) AND r.is_active = true
        ) as range_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          )
          FROM dwelling_type dt
          WHERE dt.dwelling_type_id = ANY(p.dwelling_type_id) AND dt.is_active = true
        ) as dwelling_type_data,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', pg.package_group_id,
              'name', pg.name
            )
          )
          FROM package_group pg
          WHERE pg.package_group_id = ANY(p.package_group_id)
        ) as package_group_data
      FROM package p
      WHERE p.package_id = $1
    `;

    const updatedPackageResult = await client.query(getUpdatedPackageQuery, [
      package_id,
    ]);
    const updatedPackage = keysToCamelCase(updatedPackageResult.rows[0]);

    const formattedPackage = {
      packageId: updatedPackage.packageId,
      companyId: updatedPackage.companyId,
      builderId: updatedPackage.builderId,
      name: updatedPackage.name,
      cost: updatedPackage.cost ? updatedPackage.cost.toString() : null,
      builderCost: updatedPackage.builderCost
        ? updatedPackage.builderCost.toString()
        : null,
      sortOrder: updatedPackage.sortOrder,
      status: updatedPackage.status,
      allowAddItemFromPricelist: updatedPackage.allowAddItemFromPricelist,
      allowRemovePackageItems: updatedPackage.allowRemovePackageItems,
      range: updatedPackage.rangeData || [],
      dwellingType: updatedPackage.dwellingTypeData || [],
      packageGroup: updatedPackage.packageGroupData || [],
      createdBy: updatedPackage.createdBy,
      updatedBy: updatedPackage.updatedBy,
      createdAt: updatedPackage.createdAt,
      updatedAt: updatedPackage.updatedAt,
    };

    return successResponse(
      res,
      formattedPackage,
      "Package updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("updatePackage error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
