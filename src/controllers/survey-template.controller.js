const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createSurveyTemplate = async (req, res) => {
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
      sort_order,
      is_recommended = false,
      status = true,
    } = req.body;

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM survey_template
      WHERE company_id = $1
        AND builder_id = $2
        AND LOWER(name) = LOWER($3)
      `,
      [companyId, builderId, name],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Survey template with this name already exists.",
      );
    }

    const maxOrderRes = await client.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM survey_template
      WHERE company_id = $1 AND builder_id = $2
      `,
      [companyId, builderId],
    );

    const maxSortOrder = Number(maxOrderRes.rows[0].max_sort_order);

    let finalSortOrder;

    if (sort_order === undefined || sort_order === null) {
      finalSortOrder = maxSortOrder + 1;
    } else {
      if (sort_order < 1 || sort_order > maxSortOrder + 1) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
        );
      }

      finalSortOrder = sort_order;

      await client.query(
        `
        UPDATE survey_template
        SET sort_order = sort_order + 1
        WHERE company_id = $1
          AND builder_id = $2
          AND sort_order >= $3
        `,
        [companyId, builderId, finalSortOrder],
      );
    }

    if (is_recommended === true) {
      await client.query(
        `
        UPDATE survey_template
        SET is_recommended = false
        WHERE company_id = $1
          AND builder_id = $2
        `,
        [companyId, builderId],
      );
    }

    const insertRes = await client.query(
      `
      INSERT INTO survey_template (
        company_id,
        builder_id,
        name,
        sort_order,
        is_recommended,
        status,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
      RETURNING *
      `,
      [
        companyId,
        builderId,
        name,
        finalSortOrder,
        is_recommended,
        status,
        userId,
      ],
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertRes.rows[0]),
      "Survey template created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Survey Template Error:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Survey template with this name already exists.",
      );
    }

    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllSurveyTemplate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25, name, sort_order, status } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let conditions = ["builder_id = $1"];
    let values = [builderId];
    let paramIndex = 2;

    if (name !== undefined && name.trim() !== "") {
      conditions.push(`LOWER(name) LIKE LOWER($${paramIndex})`);
      values.push(`%${name.trim()}%`);
      paramIndex++;
    }

    if (status !== undefined) {
      if (!["true", "false"].includes(status)) {
        return errorResponse(res, 400, "status must be true or false");
      }
      conditions.push(`status = $${paramIndex}`);
      values.push(status === "true");
      paramIndex++;
    }

    if (sort_order !== undefined) {
      const sortValue = parseInt(sortOrder, 10);
      if (!isNaN(sortValue)) {
        conditions.push(`sort_order = $${paramIndex}`);
        values.push(sortValue);
        paramIndex++;
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const dataQuery = `
      SELECT 
        *
      FROM survey_template
      ${whereClause}
      ORDER BY sort_order ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    values.push(limitValue, offset);

    const dataResult = await client.query(dataQuery, values);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM survey_template
      ${whereClause};
    `;

    const countValues = values.slice(0, -2);
    const countResult = await client.query(countQuery, countValues);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        surveyTemplates: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Survey templates fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching survey templates:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSurveyTemplate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { survey_template_id } = req.params;

    if (!survey_template_id) {
      return errorResponse(res, 400, "survey_template_id is required.");
    }

    const checkQuery = `
      SELECT survey_template_id, sort_order
      FROM survey_template
      WHERE survey_template_id = $1 AND builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [
      survey_template_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or you are not allowed to delete this record.",
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;

    // Shift sort orders down after deletion
    const shiftSortOrderQuery = `
      UPDATE survey_template
      SET sort_order = sort_order - 1
      WHERE sort_order > $1
        AND builder_id = $2
        AND company_id = $3
    `;

    await client.query(shiftSortOrderQuery, [
      deletedSortOrder,
      builderId,
      req.user.company_id,
    ]);

    const deleteQuery = `
      DELETE FROM survey_template 
      WHERE survey_template_id = $1 AND builder_id = $2
    `;

    await client.query(deleteQuery, [survey_template_id, builderId]);

    return successResponse(
      res,
      200,
      "Survey template deleted successfully.",
      null,
    );
  } catch (error) {
    console.error("Delete Survey Template Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateSurveyTemplate = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const { survey_template_id } = req.params;

    if (!survey_template_id) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "survey_template_id is required.");
    }

    const { name, sort_order, is_recommended, status } = req.body;

    const checkQuery = `
      SELECT *
      FROM survey_template
      WHERE survey_template_id = $1
        AND builder_id = $2
        AND company_id = $3
      FOR UPDATE
    `;

    const checkResult = await client.query(checkQuery, [
      survey_template_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Record not found or you are not allowed to update this record.",
      );
    }

    const oldTemplate = checkResult.rows[0];
    const currentStatus = oldTemplate.status;
    const statusInBody = req.body.status !== undefined;
    const requestedStatus = status;

    const fieldsToCheck = ["name", "sort_order", "is_recommended"];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'status' field must be a boolean (true or false).",
      );
    }

    if (name) {
      const nameCheckQuery = `
        SELECT survey_template_id
        FROM survey_template
        WHERE name = $1
          AND company_id = $2
          AND builder_id = $3
          AND survey_template_id != $4
      `;
      const nameResult = await client.query(nameCheckQuery, [
        name,
        companyId,
        builderId,
        survey_template_id,
      ]);

      if (nameResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Survey template name already exists for this builder.",
        );
      }
    }

    if (sort_order !== undefined) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM survey_template
        WHERE company_id = $1 AND builder_id = $2;
      `;

      const maxSortOrderResult = await client.query(maxSortOrderQuery, [
        companyId,
        builderId,
      ]);

      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      if (sort_order < 1 || sort_order > maxSortOrder + 1) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
        );
      }

      const oldSortOrder = oldTemplate.sort_order;

      if (sort_order !== oldSortOrder) {
        if (sort_order < oldSortOrder) {
          const shiftUpQuery = `
            UPDATE survey_template
            SET sort_order = sort_order + 1
            WHERE sort_order >= $1
              AND sort_order < $2
              AND company_id = $3
              AND builder_id = $4
              AND survey_template_id != $5
          `;

          await client.query(shiftUpQuery, [
            sort_order,
            oldSortOrder,
            companyId,
            builderId,
            survey_template_id,
          ]);
        } else {
          const shiftDownQuery = `
            UPDATE survey_template
            SET sort_order = sort_order - 1
            WHERE sort_order > $1
              AND sort_order <= $2
              AND company_id = $3
              AND builder_id = $4
              AND survey_template_id != $5
          `;

          await client.query(shiftDownQuery, [
            oldSortOrder,
            sort_order,
            companyId,
            builderId,
            survey_template_id,
          ]);
        }
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    const push = (column, value) => {
      fields.push(`${column} = $${index++}`);
      values.push(value);
    };

    if (name !== undefined) push("name", name);
    if (sort_order !== undefined) push("sort_order", sort_order);
    if (is_recommended !== undefined) {
      if (is_recommended === true) {
        const updateRecommendedQuery = `
          UPDATE survey_template 
          SET is_recommended = false
          WHERE company_id = $1
            AND builder_id = $2
            AND is_recommended = true
            AND survey_template_id != $3
        `;

        await client.query(updateRecommendedQuery, [
          companyId,
          builderId,
          survey_template_id,
        ]);
      }

      push("is_recommended", is_recommended);
    }

    if (statusInBody) push("status", requestedStatus);

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    push("updated_by", userId);
    fields.push(`updated_at = NOW()`);

    const whereClauseValues = [survey_template_id, builderId, companyId];

    const updateQuery = `
      UPDATE survey_template
      SET ${fields.join(", ")}
      WHERE survey_template_id = $${index++}
        AND builder_id = $${index++}
        AND company_id = $${index}
      RETURNING *
    `;

    values.push(...whereClauseValues);

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Survey template updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Survey Template Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};
