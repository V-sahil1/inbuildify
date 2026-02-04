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
      const builderCheck = await client.query(
        `SELECT builder_id FROM builder WHERE builder_id = $1`,
        [builder],
      );
      if (builderCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid builder ID.");
      }
    }

    const duplicateNameCheck = await client.query(
      `
      SELECT 1
      FROM construction_type
      WHERE types_name = $1
        AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR (builder_id = $3 AND $3 IS NOT NULL)
        )
      LIMIT 1
      `,
      [types_name, companyId, builderId],
    );

    if (duplicateNameCheck.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Construction type with this name already exists.",
      );
    }

    if (sort_order == null) sort_order = 1;

    const {
      rows: [{ max_sort_order }],
    } = await client.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM construction_type
      WHERE
        (company_id = $1 AND $1 IS NOT NULL)
        OR
        (builder_id = $2 AND $2 IS NOT NULL)
      `,
      [companyId, builderId],
    );

    if (sort_order < 1 || sort_order > max_sort_order + 1) {
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${max_sort_order + 1}.`,
      );
    }

    await client.query(
      `
      UPDATE construction_type
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR
          (builder_id = $3 AND $3 IS NOT NULL)
        )
      `,
      [sort_order, companyId, builderId],
    );

    if (dwelling_type.length > 0) {
      const activeCheck = await client.query(
        `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = ANY($1::uuid[])
          AND builder_id = $2
          AND is_active = true
        `,
        [dwelling_type, builderId],
      );

      if (activeCheck.rowCount !== dwelling_type.length) {
        return errorResponse(
          res,
          400,
          "One or more dwelling_type IDs are invalid or inactive.",
        );
      }
    }

    const insertResult = await client.query(
      `
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
      RETURNING construction_type_id;
      `,
      [
        companyId,
        builderId,
        builder || null,
        types_name,
        start_construction_days,
        sort_order,
        dwelling_type,
        userId,
      ],
    );

    const constructionTypeId = insertResult.rows[0].construction_type_id;

    const responseQuery = `
      SELECT
  ct.construction_type_id,
  ct.types_name,
  ct.sort_order,
  ct.start_construction_days,

  json_build_object(
    'id', b.builder_id,
    'name', b.name
  ) AS builder,

  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', dt.dwelling_type_id,
        'name', dt.name
      )
    ) FILTER (WHERE dt.dwelling_type_id IS NOT NULL),
    '[]'
  ) AS dwelling_type

FROM construction_type ct
LEFT JOIN builder b
  ON b.builder_id = ct.builder   
LEFT JOIN dwelling_type dt
  ON dt.dwelling_type_id = ANY(ct.dwelling_type)

WHERE ct.construction_type_id = $1
GROUP BY ct.construction_type_id, b.builder_id;

    `;

    const responseResult = await client.query(responseQuery, [
      constructionTypeId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction type created successfully.",
    );
  } catch (error) {
    console.error("Create Construction Type Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionTypes = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const loggedInBuilderId = req.user.builder_id;
    const { builder } = req.query;

    let whereClause = "";
    let values = [];

    if (builder) {
      whereClause = `WHERE ct.builder = $1 AND ct.builder_id = $2`;
      values = [builder, loggedInBuilderId];
    } else {
      whereClause = `WHERE ct.builder_id = $1`;
      values = [loggedInBuilderId];
    }

    const dataQuery = `
      SELECT
        ct.construction_type_id,
        ct.types_name,
        ct.sort_order,
        ct.start_construction_days,
        ct.created_at,

        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          ) FILTER (WHERE dt.dwelling_type_id IS NOT NULL),
          '[]'
        ) AS dwelling_type

      FROM construction_type ct
      JOIN builder b
        ON b.builder_id = ct.builder
      LEFT JOIN dwelling_type dt
        ON dt.dwelling_type_id = ANY (ct.dwelling_type)

      ${whereClause}

      GROUP BY
        ct.construction_type_id,
        b.builder_id

      ORDER BY ct.sort_order ASC, ct.created_at DESC;
    `;

    const dataResult = await client.query(dataQuery, values);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
      "Construction types fetched successfully.",
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
        "Construction type not found or access denied.",
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
      err.message || "Failed to delete construction type.",
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

    const existingResult = await client.query(
      `
      SELECT *
      FROM construction_type
      WHERE construction_type_id = $1
        AND builder_id = $2
      LIMIT 1
      `,
      [construction_type_id, builderId],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction type not found or access denied.",
      );
    }

    const existingSortOrder = existingResult.rows[0].sort_order;

    if (types_name) {
      const duplicateNameResult = await client.query(
        `
        SELECT 1
        FROM construction_type
        WHERE types_name = $1
          AND construction_type_id != $2
          AND (
            (company_id = $3 AND $3 IS NOT NULL)
            OR
            (builder_id = $4 AND $4 IS NOT NULL)
          )
        LIMIT 1
        `,
        [types_name, construction_type_id, companyId, builderId],
      );

      if (duplicateNameResult.rowCount > 0) {
        return errorResponse(
          res,
          409,
          "Construction type with this name already exists.",
        );
      }
    }

    if (sort_order !== undefined && sort_order !== null) {
      const {
        rows: [{ max_sort_order }],
      } = await client.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM construction_type
        WHERE
          (company_id = $1 AND $1 IS NOT NULL)
          OR
          (builder_id = $2 AND $2 IS NOT NULL)
        `,
        [companyId, builderId],
      );

      if (sort_order < 1 || sort_order > max_sort_order) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${max_sort_order}.`,
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
            ],
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
            ],
          );
        }
      }
    }

    if (dwelling_type && dwelling_type.length > 0) {
      const activeCheck = await client.query(
        `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = ANY($1::uuid[])
          AND builder_id = $2
          AND is_active = true
        `,
        [dwelling_type, builderId],
      );

      if (activeCheck.rowCount !== dwelling_type.length) {
        return errorResponse(
          res,
          400,
          "One or more dwelling_type IDs are invalid or inactive.",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (types_name !== undefined) {
      updateFields.push(`types_name = $${idx++}`);
      updateValues.push(types_name);
    }
    if (start_construction_days !== undefined) {
      updateFields.push(`start_construction_days = $${idx++}`);
      updateValues.push(start_construction_days);
    }
    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${idx++}`);
      updateValues.push(sort_order);
    }
    if (dwelling_type !== undefined) {
      updateFields.push(`dwelling_type = $${idx++}`);
      updateValues.push(dwelling_type);
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "No fields provided for update.");
    }

    updateFields.push(`updated_by = $${idx++}`);
    updateValues.push(userId);
    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `
      UPDATE construction_type
      SET ${updateFields.join(", ")}
      WHERE construction_type_id = $${idx}
        AND builder_id = $${idx + 1}
      `,
      [...updateValues, construction_type_id, builderId],
    );

    const responseResult = await client.query(
      `
      SELECT
        ct.construction_type_id,
        ct.types_name,
        ct.sort_order,
        ct.start_construction_days,

        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', dt.dwelling_type_id,
              'name', dt.name
            )
          ) FILTER (WHERE dt.dwelling_type_id IS NOT NULL),
          '[]'
        ) AS dwelling_type

      FROM construction_type ct
      JOIN builder b
        ON b.builder_id = ct.builder
      LEFT JOIN dwelling_type dt
        ON dt.dwelling_type_id = ANY(ct.dwelling_type)

      WHERE ct.construction_type_id = $1

      GROUP BY ct.construction_type_id, b.builder_id
      `,
      [construction_type_id],
    );

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction type updated successfully.",
    );
  } catch (error) {
    console.error("Update Construction Type Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
