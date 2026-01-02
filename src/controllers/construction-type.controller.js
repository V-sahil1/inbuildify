const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    let {
      builder,
      types_name,
      start_construction_days = 21,
      sort_order,
      dwelling_type = [],
    } = req.body;

    if (builder) {
      const builderCheckQuery = `
        SELECT builder_id
        FROM builder
        WHERE builder_id = $1
        LIMIT 1;
      `;

      const builderCheckResult = await client.query(builderCheckQuery, [
        builder,
      ]);

      if (builderCheckResult.rowCount === 0) {
        return errorResponse(res, 400, "Invalid builder ID.");
      }
    }

    const duplicateNameQuery = `
      SELECT construction_type_id
      FROM construction_type
      WHERE types_name = $1
        AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR (builder_id = $3 AND $3 IS NOT NULL)
        )
      LIMIT 1;
    `;

    const duplicateNameResult = await client.query(duplicateNameQuery, [
      types_name,
      companyId,
      builderId,
    ]);

    if (duplicateNameResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Construction type with this name already exists."
      );
    }

    if (sort_order === undefined || sort_order === null) {
      sort_order = 1;
    }

    const maxSortOrderQuery = `
  SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
  FROM construction_type
  WHERE
    (
      (company_id = $1 AND $1 IS NOT NULL)
      OR
      (builder_id = $2 AND $2 IS NOT NULL)
    )
`;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      companyId,
      builderId,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (sort_order > maxSortOrder + 1 || sort_order < 1) {
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`
      );
    }

    const shiftSortOrderQuery = `
  UPDATE construction_type
  SET sort_order = sort_order + 1
  WHERE sort_order >= $1
    AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR
      (builder_id = $3 AND $3 IS NOT NULL)
    )
`;

    await client.query(shiftSortOrderQuery, [sort_order, companyId, builderId]);

    if (dwelling_type.length > 0) {
      const dwellingCheckQuery = `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = ANY($1::uuid[]) AND builder_id = $2;
      `;

      const dwellingCheckResult = await client.query(dwellingCheckQuery, [
        dwelling_type,
        builderId,
      ]);

      if (dwellingCheckResult.rowCount !== dwelling_type.length) {
        return errorResponse(
          res,
          400,
          "One or more dwelling_type IDs are invalid."
        );
      }
    }

    if (dwelling_type.length > 0) {
      const dwellingCheckQuery = `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = ANY($1::uuid[]) AND builder_id = $2 AND is_active = true;
      `;

      const dwellingCheckResult = await client.query(dwellingCheckQuery, [
        dwelling_type,
        builderId,
      ]);

      if (dwellingCheckResult.rowCount !== dwelling_type.length) {
        return errorResponse(
          res,
          400,
          "One or more dwelling_type IDs are inactive."
        );
      }
    }

    const insertQuery = `
      INSERT INTO construction_type (
        company_id,
        builder_id,
        builder,
        types_name,
        start_construction_days,
        sort_order,
        dwelling_type,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      builder || null,
      types_name,
      start_construction_days,
      sort_order,
      dwelling_type,
      userId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction type created successfully."
    );
  } catch (error) {
    console.error("Create Construction Type Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionTypes = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const loggedInBuilderId = req.user.builder_id;
    const { page = 1, limit = 25, builder } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let whereClause;
    let values = [];

    if (builder) {
      whereClause = `WHERE builder = $1 AND builder_id = $2`;
      values = [builder, loggedInBuilderId];
    } else {
      whereClause = `WHERE builder_id = $1`;
      values = [loggedInBuilderId];
    }

    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;

    const dataQuery = `
  SELECT *
  FROM construction_type
  ${whereClause}
  ORDER BY sort_order ASC, created_at DESC
  LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder};
`;

    const dataResult = await client.query(dataQuery, [
      ...values,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM construction_type
      ${whereClause};
    `;
    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        constructionTypes: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Construction types fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching construction types:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteConstructionType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { construction_type_id } = req.params;
    const { user_id } = req.user;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT construction_type_id, sort_order
      FROM construction_type
      WHERE construction_type_id = $1
        AND builder_id = $2;
    `;

    const checkResult = await client.query(checkQuery, [
      construction_type_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Construction type not found or access denied."
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;

    const deleteQuery = `
      DELETE FROM construction_type
      WHERE construction_type_id = $1
        AND builder_id = $2
      RETURNING construction_type_id;
    `;

    await client.query(deleteQuery, [construction_type_id, builderId]);

    const shiftQuery = `
      UPDATE construction_type
      SET sort_order = sort_order - 1
      WHERE builder_id = $1
        AND sort_order > $2
    `;

    await client.query(shiftQuery, [builderId, deletedSortOrder]);

    await client.query("COMMIT");

    return successResponse(res, {}, "Construction type deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting construction type:", err);
    return errorResponse(
      res,
      500,
      err.message || "Failed to delete construction type."
    );
  } finally {
    client.release();
  }
};

exports.updateConstructionType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { construction_type_id } = req.params;

    if (!construction_type_id) {
      return errorResponse(res, 400, "construction_type_id is required.");
    }

    let { types_name, start_construction_days, sort_order, dwelling_type } =
      req.body;

    const existingQuery = `
      SELECT *
      FROM construction_type
      WHERE construction_type_id = $1
        AND builder_id = $2
      LIMIT 1;
    `;
    const existingResult = await client.query(existingQuery, [
      construction_type_id,
      builderId,
    ]);

    if (existingResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction type not found or access denied."
      );
    }

    if (types_name) {
      const duplicateNameQuery = `
        SELECT construction_type_id
        FROM construction_type
        WHERE types_name = $1
          AND construction_type_id != $2
          AND (
            (company_id = $3 AND $3 IS NOT NULL)
            OR (builder_id = $4 AND $4 IS NOT NULL)
          )
        LIMIT 1;
      `;
      const duplicateNameResult = await client.query(duplicateNameQuery, [
        types_name,
        construction_type_id,
        companyId,
        builderId,
      ]);

      if (duplicateNameResult.rowCount > 0) {
        return errorResponse(
          res,
          409,
          "Construction type with this name already exists."
        );
      }
    }

    let existingSortOrder = existingResult.rows[0].sort_order;

    if (sort_order !== undefined && sort_order !== null) {
      const maxSortQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM construction_type
    WHERE
      (
        (company_id = $1 AND $1 IS NOT NULL)
        OR
        (builder_id = $2 AND $2 IS NOT NULL)
      )
  `;
      const maxSortResult = await client.query(maxSortQuery, [
        companyId,
        builderId,
      ]);

      const maxSortOrder = maxSortResult.rows[0].max_sort_order;

      if (sort_order < 1 || sort_order > maxSortOrder + 1) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`
        );
      }

      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          await client.query(
            `
        UPDATE construction_type
        SET sort_order = sort_order - 1
        WHERE sort_order > $1
          AND sort_order <= $2
          AND construction_type_id != $3
          AND (
            (company_id = $4 AND $4 IS NOT NULL)
            OR
            (builder_id = $5 AND $5 IS NOT NULL)
          )
        `,
            [
              existingSortOrder,
              sort_order,
              construction_type_id,
              companyId,
              builderId,
            ]
          );
        } else {
          await client.query(
            `
        UPDATE construction_type
        SET sort_order = sort_order + 1
        WHERE sort_order >= $1
          AND sort_order < $2
          AND construction_type_id != $3
          AND (
            (company_id = $4 AND $4 IS NOT NULL)
            OR
            (builder_id = $5 AND $5 IS NOT NULL)
          )
        `,
            [
              sort_order,
              existingSortOrder,
              construction_type_id,
              companyId,
              builderId,
            ]
          );
        }
      }
    }

    if (dwelling_type && dwelling_type.length > 0) {
      const dwellingCheckQuery = `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = ANY($1::uuid[])
          AND builder_id = $2;
      `;
      const dwellingCheckResult = await client.query(dwellingCheckQuery, [
        dwelling_type,
        builderId,
      ]);
      if (dwellingCheckResult.rowCount !== dwelling_type.length) {
        return errorResponse(
          res,
          400,
          "One or more dwelling_type IDs are invalid."
        );
      }

      const dwellingActiveCheckQuery = `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = ANY($1::uuid[])
          AND builder_id = $2
          AND is_active = true;
      `;
      const dwellingActiveCheckResult = await client.query(
        dwellingActiveCheckQuery,
        [dwelling_type, builderId]
      );
      if (dwellingActiveCheckResult.rowCount !== dwelling_type.length) {
        return errorResponse(
          res,
          400,
          "One or more dwelling_type IDs are inactive."
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (types_name !== undefined) {
      updateFields.push(`types_name = $${idx}`);
      updateValues.push(types_name);
      idx++;
    }
    if (start_construction_days !== undefined) {
      updateFields.push(`start_construction_days = $${idx}`);
      updateValues.push(start_construction_days);
      idx++;
    }
    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${idx}`);
      updateValues.push(sort_order);
      idx++;
    }
    if (dwelling_type !== undefined) {
      updateFields.push(`dwelling_type = $${idx}`);
      updateValues.push(dwelling_type);
      idx++;
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided for update.");
    }

    updateFields.push(`updated_by = $${idx}`);
    updateValues.push(userId);
    idx++;
    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    const updateQuery = `
      UPDATE construction_type
      SET ${updateFields.join(", ")}
      WHERE construction_type_id = $${idx}
        AND builder_id = $${idx + 1}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      ...updateValues,
      construction_type_id,
      builderId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction type updated successfully."
    );
  } catch (error) {
    console.error("Update Construction Type Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};
