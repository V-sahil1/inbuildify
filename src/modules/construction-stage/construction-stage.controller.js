import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createConstructionStage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    let {
      builder,
      construction_type_id,
      stage_name,
      days = 10,
      sort_order,
      site_image = false,
      inspection = "not_required",
      bg_color,
      font_color,
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

    const constructionTypeCheckQuery = `
      SELECT construction_type_id
      FROM construction_type
      WHERE construction_type_id = $1
        AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR (builder_id = $3 AND $3 IS NOT NULL)
        )
      LIMIT 1;
    `;
    const constructionTypeResult = await client.query(
      constructionTypeCheckQuery,
      [construction_type_id, companyId, builderId],
    );

    if (constructionTypeResult.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "Invalid or unauthorized construction_type_id.",
      );
    }

    const duplicateStageQuery = `
      SELECT construction_stage
      FROM construction_stage
      WHERE stage_name = $1
        AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR (builder_id = $3 AND $3 IS NOT NULL)
        )
      LIMIT 1;
    `;
    const duplicateStageResult = await client.query(duplicateStageQuery, [
      stage_name,
      companyId,
      builderId,
    ]);

    if (duplicateStageResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Construction stage with this name already exists.",
      );
    }

    if (sort_order === undefined || sort_order === null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM construction_stage
        WHERE construction_type_id = $1
          AND (
            (company_id = $2 AND $2 IS NOT NULL)
            OR (builder_id = $3 AND $3 IS NOT NULL)
          )
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        construction_type_id,
        companyId,
        builderId,
      ]);
      const maxSort = maxSortResult.rows[0].max_sort;
      sort_order = maxSort + 1;
    } else {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM construction_stage
        WHERE construction_type_id = $1
          AND (
            (company_id = $2 AND $2 IS NOT NULL)
            OR (builder_id = $3 AND $3 IS NOT NULL)
          )
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        construction_type_id,
        companyId,
        builderId,
      ]);
      const maxSort = maxSortResult.rows[0].max_sort;

      if (sort_order < 1 || sort_order > maxSort + 1) {
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`,
        );
      }

      if (sort_order <= maxSort) {
        const shiftQuery = `
          UPDATE construction_stage
          SET sort_order = sort_order + 1
          WHERE construction_type_id = $1
            AND (
              (company_id = $2 AND $2 IS NOT NULL)
              OR (builder_id = $3 AND $3 IS NOT NULL)
            )
            AND sort_order >= $4
        `;
        await client.query(shiftQuery, [
          construction_type_id,
          companyId,
          builderId,
          sort_order,
        ]);
      }
    }

    const validInspectionValues = [
      "not_required",
      "stage_start",
      "stage_completed",
    ];
    if (!validInspectionValues.includes(inspection)) {
      return errorResponse(res, 400, "Invalid inspection value.");
    }

    const insertQuery = `
      INSERT INTO construction_stage (
        company_id,
        builder_id,
        builder,
        construction_type_id,
        stage_name,
        days,
        sort_order,
        site_image,
        inspection,
        bg_color,
        font_color,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      builder || null,
      construction_type_id,
      stage_name,
      days,
      sort_order,
      site_image,
      inspection,
      bg_color || null,
      font_color || null,
      userId,
    ]);

    await client.query("COMMIT");

    const constructionStageId = result.rows[0].construction_stage;

    const responseQuery = `
      SELECT
        cs.construction_stage,
        cs.stage_name,
        cs.days,
        cs.sort_order,
        cs.site_image,
        cs.inspection,
        cs.bg_color,
        cs.font_color,
        cs.created_at,
        cs.updated_at,

        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,

        json_build_object(
          'id', ct.construction_type_id,
          'name', ct.types_name
        ) AS construction_type

      FROM construction_stage cs
      LEFT JOIN builder b
        ON b.builder_id = cs.builder
      LEFT JOIN construction_type ct
        ON ct.construction_type_id = cs.construction_type_id
      WHERE cs.construction_stage = $1
      GROUP BY cs.construction_stage, b.builder_id, ct.construction_type_id;
    `;

    const responseResult = await client.query(responseQuery, [
      constructionStageId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction stage created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Construction Stage Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
}

export async function getAllConstructionStages(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const loggedInBuilderId = req.user.builder_id;
    const { builder, construction_type_id } = req.query;

    const whereClauses = [];
    const values = [];

    if (builder) {
      whereClauses.push("cs.builder = $1 AND cs.builder_id = $2");
      values.push(builder, loggedInBuilderId);
    } else {
      whereClauses.push("cs.builder_id = $1");
      values.push(loggedInBuilderId);
    }

    if (construction_type_id) {
      whereClauses.push(`cs.construction_type_id = $${values.length + 1}`);
      values.push(construction_type_id);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const dataQuery = `
      SELECT
        cs.construction_stage,
        cs.stage_name,
        cs.days,
        cs.sort_order,
        cs.site_image,
        cs.inspection,
        cs.bg_color,
        cs.font_color,
        cs.created_at,
        cs.updated_at,

        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,

        json_build_object(
          'id', ct.construction_type_id,
          'name', ct.types_name
        ) AS construction_type

      FROM construction_stage cs
      LEFT JOIN builder b
        ON b.builder_id = cs.builder
      LEFT JOIN construction_type ct
        ON ct.construction_type_id = cs.construction_type_id
      ${whereClause}
      GROUP BY cs.construction_stage, b.builder_id, ct.construction_type_id
      ORDER BY cs.sort_order ASC, cs.created_at DESC;
    `;

    const dataResult = await client.query(dataQuery, values);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
      "Construction stages fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching construction stages:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteConstructionStage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const builderId = req.user?.builder_id;
    const { construction_stage } = req.params;

    if (!builderId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "Unauthorized. Builder login required.");
    }

    if (!construction_stage) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Construction stage ID is required.");
    }

    const checkQuery = `
      SELECT construction_stage, sort_order, construction_type_id
      FROM construction_stage
      WHERE construction_stage = $1
        AND builder_id = $2;
    `;

    const checkResult = await client.query(checkQuery, [
      construction_stage,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Construction stage not found or access denied.",
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;
    const constructionTypeId = checkResult.rows[0].construction_type_id;

    const deleteQuery = `
      DELETE FROM construction_stage
      WHERE construction_stage = $1
        AND builder_id = $2
      RETURNING construction_stage;
    `;

    await client.query(deleteQuery, [construction_stage, builderId]);

    const shiftQuery = `
      UPDATE construction_stage
      SET sort_order = sort_order - 1
      WHERE builder_id = $1
        AND construction_type_id = $2
        AND sort_order > $3
    `;

    await client.query(shiftQuery, [
      builderId,
      constructionTypeId,
      deletedSortOrder,
    ]);

    await client.query("COMMIT");

    return successResponse(res, {}, "Construction stage deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting construction stage:", error);
    return errorResponse(
      res,
      500,
      error.message || "Failed to delete construction stage.",
    );
  } finally {
    client.release();
  }
}

export async function updateConstructionStage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { construction_stage } = req.params;

    if (!builderId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "Unauthorized. Builder login required.");
    }

    if (!construction_stage) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Construction stage ID is required.");
    }

    const {
      stage_name,
      days,
      sort_order,
      site_image,
      inspection,
      bg_color,
      font_color,
    } = req.body;

    const existingQuery = `
      SELECT *
      FROM construction_stage
      WHERE construction_stage = $1
        AND builder_id = $2
      LIMIT 1;
    `;
    const existingResult = await client.query(existingQuery, [
      construction_stage,
      builderId,
    ]);

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Construction stage not found or access denied.",
      );
    }

    const existingData = existingResult.rows[0];
    const oldSortOrder = existingData.sort_order;
    const constructionTypeId = existingData.construction_type_id;

    if (stage_name) {
      const duplicateStageQuery = `
        SELECT construction_stage
        FROM construction_stage
        WHERE stage_name = $1
          AND construction_stage != $2
          AND (
            (company_id = $3 AND $3 IS NOT NULL)
            OR (builder_id = $4 AND $4 IS NOT NULL)
          )
        LIMIT 1;
      `;
      const duplicateStageResult = await client.query(duplicateStageQuery, [
        stage_name,
        construction_stage,
        companyId,
        builderId,
      ]);

      if (duplicateStageResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          "Construction stage with this name already exists.",
        );
      }
    }

    const updateFields = [];
    const values = [];
    let idx = 1;

    if (stage_name !== undefined) {
      updateFields.push(`stage_name = $${idx}`);
      values.push(stage_name);
      idx++;
    }

    if (days !== undefined) {
      updateFields.push(`days = $${idx}`);
      values.push(days);
      idx++;
    }

    if (sort_order !== undefined) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM construction_stage
        WHERE construction_type_id = $1
          AND (
            (company_id = $2 AND $2 IS NOT NULL)
            OR (builder_id = $3 AND $3 IS NOT NULL)
          )
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        constructionTypeId,
        companyId,
        builderId,
      ]);
      const maxSort = maxSortResult.rows[0].max_sort;

      if (sort_order < 1 || sort_order > maxSort + 1) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`,
        );
      }

      if (sort_order !== oldSortOrder) {
        if (sort_order > oldSortOrder) {
          const shiftDownQuery = `
            UPDATE construction_stage
            SET sort_order = sort_order + 1
            WHERE construction_type_id = $1
              AND (
                (company_id = $2 AND $2 IS NOT NULL)
                OR (builder_id = $3 AND $3 IS NOT NULL)
              )
              AND sort_order > $4
              AND sort_order <= $5
              AND construction_stage != $6
          `;
          await client.query(shiftDownQuery, [
            constructionTypeId,
            companyId,
            builderId,
            oldSortOrder,
            sort_order,
            construction_stage,
          ]);
        } else {
          const shiftUpQuery = `
            UPDATE construction_stage
            SET sort_order = sort_order - 1
            WHERE construction_type_id = $1
              AND (
                (company_id = $2 AND $2 IS NOT NULL)
                OR (builder_id = $3 AND $3 IS NOT NULL)
              )
              AND sort_order >= $4
              AND sort_order < $5
              AND construction_stage != $6
          `;
          await client.query(shiftUpQuery, [
            constructionTypeId,
            companyId,
            builderId,
            sort_order,
            oldSortOrder,
            construction_stage,
          ]);
        }
      }

      updateFields.push(`sort_order = $${idx}`);
      values.push(sort_order);
      idx++;
    }

    if (site_image !== undefined) {
      updateFields.push(`site_image = $${idx}`);
      values.push(site_image);
      idx++;
    }

    if (inspection !== undefined) {
      updateFields.push(`inspection = $${idx}`);
      values.push(inspection);
      idx++;
    }

    if (bg_color !== undefined) {
      updateFields.push(`bg_color = $${idx}`);
      values.push(bg_color);
      idx++;
    }

    if (font_color !== undefined) {
      updateFields.push(`font_color = $${idx}`);
      values.push(font_color);
      idx++;
    }

    updateFields.push(`updated_by = $${idx}`);
    values.push(userId);
    idx++;
    updateFields.push("updated_at = NOW()");

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    const updateQuery = `
      UPDATE construction_stage
      SET ${updateFields.join(", ")}
      WHERE construction_stage = $${idx}
        AND builder_id = $${idx + 1}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      ...values,
      construction_stage,
      builderId,
    ]);

    await client.query("COMMIT");

    const responseQuery = `
      SELECT
        cs.construction_stage,
        cs.stage_name,
        cs.days,
        cs.sort_order,
        cs.site_image,
        cs.inspection,
        cs.bg_color,
        cs.font_color,
        cs.created_at,
        cs.updated_at,

        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,

        json_build_object(
          'id', ct.construction_type_id,
          'name', ct.types_name
        ) AS construction_type

      FROM construction_stage cs
      LEFT JOIN builder b
        ON b.builder_id = cs.builder
      LEFT JOIN construction_type ct
        ON ct.construction_type_id = cs.construction_type_id
      WHERE cs.construction_stage = $1
      GROUP BY cs.construction_stage, b.builder_id, ct.construction_type_id;
    `;

    const responseResult = await client.query(responseQuery, [
      construction_stage,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction stage updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Construction Stage Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
}
