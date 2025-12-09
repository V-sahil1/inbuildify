const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPriceList = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    let {
      name,
      sort_order = 0,
      show_in_view_list = true,
      is_active = true,
      location = null,
    } = req.body;

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Name is required.");
    }

    await client.query("BEGIN");

    const nameExists = await client.query(
      `SELECT 1 
       FROM price_list 
       WHERE name = $1 AND company_id = $2 AND builder_id = $3`,
      [name.trim(), companyId, builderId]
    );

    if (nameExists.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Name already exists.");
    }

    if (location) {
      const locationCheck = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1`,
        [location]
      );
      if (locationCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid location (state_id).");
      }
    }

    const sortOrderCheck = await client.query(
      `SELECT sort_order 
       FROM price_list 
       WHERE company_id = $1 AND builder_id = $2
       AND sort_order = $3`,
      [companyId, builderId, sort_order]
    );

    const defaultSortExists = await client.query(
      `SELECT price_list_id 
       FROM price_list 
       WHERE company_id = $1 AND builder_id = $2
       AND sort_order = 0`,
      [companyId, builderId]
    );

    if (sort_order === 0 && defaultSortExists.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Default sort order 0 already exists. Only one record can have sort_order = 0."
      );
    }

    if (sort_order !== 0 && sortOrderCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order ${sort_order} already exists. Please use a different one.`
      );
    }

    const insertQuery = `
      INSERT INTO price_list (
        company_id,
        builder_id,
        name,
        sort_order,
        show_in_view_list,
        is_active,
        location,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      sort_order,
      show_in_view_list,
      is_active,
      location,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllPriceList = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    let { page = 1, limit = 25, is_active, search } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const offset = (page - 1) * limit;

    let conditions = [`company_id = $1`, `builder_id = $2`];
    let values = [companyId, builderId];
    let index = 3;

    if (is_active !== undefined) {
      conditions.push(`is_active = $${index}`);
      values.push(is_active === "true");
      index++;
    }

    if (search) {
      conditions.push(`LOWER(name) LIKE $${index}`);
      values.push(`%${search.toLowerCase()}%`);
      index++;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const listQuery = `
      SELECT *
      FROM price_list
      ${whereClause}
      ORDER BY sort_order ASC, name ASC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM price_list
      ${whereClause};
    `;

    const [listResult, countResult] = await Promise.all([
      client.query(listQuery, values),
      client.query(countQuery, values),
    ]);

    const rows = keysToCamelCase(listResult.rows);
    const total = parseInt(countResult.rows[0].total, 10);

    const pagination = {
      priceList: total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return successResponse(
      res,
      { data: rows, pagination },
      "Price list fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deletePriceList = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { priceListId } = req.params;

    if (!priceListId) {
      return errorResponse(res, 400, "priceListId is required.");
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT price_list_id 
      FROM price_list 
      WHERE price_list_id = $1 
        AND company_id = $2 
        AND builder_id = $3
      `,
      [priceListId, companyId, builderId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Record not found or you do not have permission to delete this."
      );
    }

    await client.query(
      `DELETE FROM price_list WHERE price_list_id = $1 AND builder_id = $2`,
      [priceListId, builderId]
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Price list deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updatePriceList = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const { priceListId } = req.params;

    if (!priceListId) {
      return errorResponse(res, 400, "priceListId is required.");
    }

    let { name, sort_order, show_in_view_list, is_active, location } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT *
      FROM price_list
      WHERE price_list_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [priceListId, companyId, builderId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Record not found or you do not have permission to update this."
      );
    }

    const current = existing.rows[0];
    const currentIsActive = current.is_active;

    const updatingOtherFields = [
      req.body.name,
      req.body.sort_order,
      req.body.show_in_view_list,
      req.body.location,
    ].some((val) => val !== undefined);

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To deactivate an active price list, 'is_active' must be the only field provided in the request."
          );
        }
      }
    }

    if (currentIsActive === false) {
      if (requestedIsActiveTrue) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive price list, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        if (is_active === undefined || requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Cannot update non-'is_active' fields when the price list is currently inactive. Only 'is_active' can be changed (to true)."
          );
        }
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Price list is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (name && name.trim() !== current.name) {
      const nameCheck = await client.query(
        `
        SELECT 1 
        FROM price_list 
        WHERE name = $1 
          AND company_id = $2 
          AND builder_id = $3
          AND price_list_id <> $4
        `,
        [name.trim(), companyId, builderId, priceListId]
      );

      if (nameCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Name already exists.");
      }
    }

    if (location) {
      const locationCheck = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1`,
        [location]
      );

      if (locationCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid location (state_id).");
      }
    }

    if (sort_order !== undefined) {
      const newSort = parseInt(sort_order, 10);

      const sortOrderCheck = await client.query(
        `
        SELECT price_list_id
        FROM price_list
        WHERE company_id = $1
          AND builder_id = $2
          AND sort_order = $3
          AND price_list_id <> $4
        `,
        [companyId, builderId, newSort, priceListId]
      );

      const defaultSortExists = await client.query(
        `
        SELECT price_list_id
        FROM price_list
        WHERE company_id = $1
          AND builder_id = $2
          AND sort_order = 0
          AND price_list_id <> $3
        `,
        [companyId, builderId, priceListId]
      );

      if (newSort === 0 && defaultSortExists.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Default sort order 0 already exists. Only one record can have sort_order = 0."
        );
      }

      if (newSort !== 0 && sortOrderCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Sort order ${newSort} already exists. Please use a different one.`
        );
      }
    }

    let updateFields = [];
    let updateValues = [];
    let idx = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${idx++}`);
      updateValues.push(name.trim());
    }
    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${idx++}`);
      updateValues.push(sort_order);
    }
    if (show_in_view_list !== undefined) {
      updateFields.push(`show_in_view_list = $${idx++}`);
      updateValues.push(show_in_view_list);
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${idx++}`);
      updateValues.push(is_active);
    }
    if (location !== undefined) {
      updateFields.push(`location = $${idx++}`);
      updateValues.push(location);
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update."
      );
    }

    updateFields.push(`updated_by = $${idx++}`);
    updateValues.push(userId);

    updateFields.push(`updated_at = NOW()`);

    updateValues.push(priceListId);

    const updateQuery = `
      UPDATE price_list
      SET ${updateFields.join(", ")}
      WHERE price_list_id = $${idx}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
