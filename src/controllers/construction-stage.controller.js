const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionStage = async (req, res) => {
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
      [construction_type_id, companyId, builderId]
    );

    if (constructionTypeResult.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "Invalid or unauthorized construction_type_id."
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
        "Construction stage with this name already exists."
      );
    }

    if (sort_order === undefined || sort_order === null) {
      // Get the maximum sort order for this construction type and assign next
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
      // Validate that the requested sort_order is within valid range
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
          `Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`
        );
      }

      // Shift existing records down if inserting at a specific position
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

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction stage created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Construction Stage Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionStages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const loggedInBuilderId = req.user.builder_id;
    const { page = 1, limit = 25, builder, construction_type_id } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let whereClauses = [];
    let values = [];

    if (builder) {
      whereClauses.push(`builder = $1 AND builder_id = $2`);
      values.push(builder, loggedInBuilderId);
    } else {
      whereClauses.push(`builder_id = $1`);
      values.push(loggedInBuilderId);
    }

    if (construction_type_id) {
      whereClauses.push(`construction_type_id = $${values.length + 1}`);
      values.push(construction_type_id);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;

    const dataQuery = `
      SELECT *
      FROM construction_stage
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
      FROM construction_stage
      ${whereClause};
    `;
    const countResult = await client.query(countQuery, values);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        constructionStages: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Construction stages fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching construction stages:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteConstructionStage = async (req, res) => {
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

    // Get the construction stage details including sort order and construction type
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
        "Construction stage not found or access denied."
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;
    const constructionTypeId = checkResult.rows[0].construction_type_id;

    // Delete the construction stage
    const deleteQuery = `
      DELETE FROM construction_stage
      WHERE construction_stage = $1
        AND builder_id = $2
      RETURNING construction_stage;
    `;

    await client.query(deleteQuery, [construction_stage, builderId]);

    // Shift up sort orders of records that come after the deleted one
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
      error.message || "Failed to delete construction stage."
    );
  } finally {
    client.release();
  }
};

exports.updateConstructionStage = async (req, res) => {
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

    let {
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
        "Construction stage not found or access denied."
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
          "Construction stage with this name already exists."
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
          `Invalid sort_order. Allowed range is 1 to ${maxSort + 1}.`
        );
      }

      if (sort_order !== oldSortOrder) {
        if (sort_order > oldSortOrder) {
          // Moving down: shift records between old+1 and new position down
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
          // Moving up: shift records between new and old-1 position up
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
    updateFields.push(`updated_at = NOW()`);

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

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction stage updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Construction Stage Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
