import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createSurveyTemplateQuestion(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    const {
      survey_template_id,
      description,
      option_type,
      options,
      sort_order,
    } = req.body;

    const allowedTypes = ["text", "radio", "star_1_to_5", "star_1_to_10"];
    if (!allowedTypes.includes(option_type)) {
      return errorResponse(res, 400, "Invalid option_type.");
    }

    // if (option_type === "radio") {
    //   if (!Array.isArray(options) || options.length === 0) {
    //     return errorResponse(
    //       res,
    //       400,
    //       "options array is required when option_type = radio.",
    //     );
    //   }
    // } else if (options?.length) {
    //   return errorResponse(
    //     res,
    //     400,
    //     "options are allowed only when option_type = radio.",
    //   );
    // }

    await client.query("BEGIN");

    const templateCheck = await client.query(
      `
      SELECT survey_template_id
      FROM survey_template
      WHERE survey_template_id = $1
        AND builder_id = $2
        AND status = true
      `,
      [survey_template_id, builderId],
    );

    if (templateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "Survey template is invalid or inactive.");
    }

    const maxOrderRes = await client.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM survey_template_questions
      WHERE survey_template_id = $1
      `,
      [survey_template_id],
    );

    const maxSortOrder = Number(maxOrderRes.rows[0].max_sort_order);

    let finalSortOrder;

    if (sort_order === undefined || sort_order === null) {
      finalSortOrder = maxSortOrder + 1; // append
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
        UPDATE survey_template_questions
        SET sort_order = sort_order + 1
        WHERE survey_template_id = $1
          AND sort_order >= $2
        `,
        [survey_template_id, finalSortOrder],
      );
    }

    const insertRes = await client.query(
      `
      INSERT INTO survey_template_questions (
        survey_template_id,
        description,
        option_type,
        options,
        sort_order,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$6)
      RETURNING *
      `,
      [
        survey_template_id,
        description,
        option_type,
        option_type === "radio" ? options : null,
        finalSortOrder,
        userId,
      ],
    );

    // Get survey template info for response
    const templateInfoQuery = `
      SELECT survey_template_id, name
      FROM survey_template
      WHERE survey_template_id = $1
    `;
    const templateInfoResult = await client.query(templateInfoQuery, [
      survey_template_id,
    ]);

    const responseData = {
      survey_question_id: insertRes.rows[0].survey_question_id,
      description: insertRes.rows[0].description,
      option_type: insertRes.rows[0].option_type,
      options: insertRes.rows[0].options,
      sort_order: insertRes.rows[0].sort_order,
      survey_template: {
        id: templateInfoResult.rows[0].survey_template_id,
        name: templateInfoResult.rows[0].name,
      },
      created_by: insertRes.rows[0].created_by,
      updated_by: insertRes.rows[0].updated_by,
      created_at: insertRes.rows[0].created_at,
      updated_at: insertRes.rows[0].updated_at,
    };

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(responseData),
      "Survey template question created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Survey Question Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function getAllSurveyTemplateQuestions(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25, survey_template_id } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let whereClause = "WHERE t.builder_id = $1";
    let queryParams = [builderId];
    let paramIndex = 2;

    if (survey_template_id) {
      whereClause += ` AND q.survey_template_id = $${paramIndex++}`;
      queryParams.push(survey_template_id);
    }

    const dataQuery = `
      SELECT 
        q.survey_question_id,
        q.description,
        q.option_type,
        q.options,
        q.sort_order,
        json_build_object(
          'id', t.survey_template_id,
          'name', t.name
        ) AS survey_template,
        q.created_by,
        q.updated_by,
        q.created_at,
        q.updated_at
      FROM survey_template_questions q
      JOIN survey_template t
        ON q.survey_template_id = t.survey_template_id
      ${whereClause}
      ORDER BY q.sort_order ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(limitValue, offset);

    const dataResult = await client.query(dataQuery, queryParams);

    queryParams = [builderId];
    paramIndex = 2;
    let countWhereClause = "WHERE t.builder_id = $1";

    if (survey_template_id) {
      countWhereClause += ` AND q.survey_template_id = $${paramIndex++}`;
      queryParams.push(survey_template_id);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM survey_template_questions q
      JOIN survey_template t
        ON q.survey_template_id = t.survey_template_id
      ${countWhereClause}
    `;
    const countResult = await client.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        questions: keysToCamelCase(dataResult.rows),
        pagination: {
          totalRecords,
          currentPage: pageValue,
          totalPages,
          limit: limitValue,
        },
      },
      "Survey template questions fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching survey template questions:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteSurveyTemplateQuestion(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { survey_question_id } = req.params;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT q.survey_question_id, q.sort_order, q.survey_template_id
      FROM survey_template_questions q
      JOIN survey_template t
        ON q.survey_template_id = t.survey_template_id
      WHERE q.survey_question_id = $1
        AND t.builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      survey_question_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Survey template question not found or not owned by this builder.",
      );
    }

    const deletedSortOrder = checkResult.rows[0].sort_order;
    const surveyTemplateId = checkResult.rows[0].survey_template_id;

    const shiftSortOrderQuery = `
      UPDATE survey_template_questions
      SET sort_order = sort_order - 1
      WHERE sort_order > $1
        AND survey_template_id = $2
    `;

    await client.query(shiftSortOrderQuery, [
      deletedSortOrder,
      surveyTemplateId,
    ]);

    const deleteQuery = `
      DELETE FROM survey_template_questions
      WHERE survey_question_id = $1;
    `;
    await client.query(deleteQuery, [survey_question_id]);

    return successResponse(
      res,
      null,
      "Survey template question deleted successfully.",
    );
  } catch (error) {
    console.error("Error deleting survey template question:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateSurveyTemplateQuestion(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { survey_question_id } = req.params;
    const { description, option_type, options, sort_order } = req.body;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT q.survey_question_id, q.survey_template_id, q.option_type
      FROM survey_template_questions q
      JOIN survey_template t
        ON q.survey_template_id = t.survey_template_id
      WHERE q.survey_question_id = $1
        AND t.builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      survey_question_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Survey template question not found or not owned by this builder.",
      );
    }

    const surveyTemplateId = checkResult.rows[0].survey_template_id;
    const currentOptionType = checkResult.rows[0].option_type;

    if (sort_order !== undefined) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM survey_template_questions
        WHERE survey_template_id = $1;
      `;

      const maxSortOrderResult = await client.query(maxSortOrderQuery, [
        surveyTemplateId,
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

      const currentSortOrderResult = await client.query(
        `
        SELECT sort_order
        FROM survey_template_questions
        WHERE survey_question_id = $1
        `,
        [survey_question_id],
      );

      const currentSortOrder = currentSortOrderResult.rows[0].sort_order;

      if (sort_order !== currentSortOrder) {
        if (sort_order < currentSortOrder) {
          const shiftUpQuery = `
            UPDATE survey_template_questions
            SET sort_order = sort_order + 1
            WHERE sort_order >= $1
              AND sort_order < $2
              AND survey_template_id = $3
              AND survey_question_id != $4
          `;

          await client.query(shiftUpQuery, [
            sort_order,
            currentSortOrder,
            surveyTemplateId,
            survey_question_id,
          ]);
        } else {
          const shiftDownQuery = `
            UPDATE survey_template_questions
            SET sort_order = sort_order - 1
            WHERE sort_order > $1
              AND sort_order <= $2
              AND survey_template_id = $3
              AND survey_question_id != $4
          `;

          await client.query(shiftDownQuery, [
            currentSortOrder,
            sort_order,
            surveyTemplateId,
            survey_question_id,
          ]);
        }
      }
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(description);
    }

    let newOptionType = currentOptionType;
    if (option_type !== undefined) {
      const validTypes = ["text", "radio", "star_1_to_5", "star_1_to_10"];
      if (!validTypes.includes(option_type)) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid option_type. Must be one of: ${validTypes.join(", ")}`,
        );
      }

      setClauses.push(`option_type = $${idx++}`);
      values.push(option_type);
      newOptionType = option_type;

      if (option_type !== "radio") {
        setClauses.push("options = NULL");
      }
    }

    if (options !== undefined) {
      if (newOptionType !== "radio") {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Options can only be updated when option_type is radio.",
        );
      }
      if (!Array.isArray(options)) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Options must be an array of strings.");
      }
      setClauses.push(`options = $${idx++}`);
      values.push(options);
    }

    if (sort_order !== undefined) {
      setClauses.push(`sort_order = $${idx++}`);
      values.push(sort_order);
    }

    if (setClauses.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    setClauses.push("updated_at = NOW()");
    values.push(survey_question_id);

    const updateQuery = `
      UPDATE survey_template_questions
      SET ${setClauses.join(", ")}
      WHERE survey_question_id = $${idx}
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, values);

    const templateInfoQuery = `
      SELECT survey_template_id, name
      FROM survey_template
      WHERE survey_template_id = $1
    `;
    const templateInfoResult = await client.query(templateInfoQuery, [
      surveyTemplateId,
    ]);

    const responseData = {
      survey_question_id: updateResult.rows[0].survey_question_id,
      description: updateResult.rows[0].description,
      option_type: updateResult.rows[0].option_type,
      options: updateResult.rows[0].options,
      sort_order: updateResult.rows[0].sort_order,
      survey_template: {
        id: templateInfoResult.rows[0].survey_template_id,
        name: templateInfoResult.rows[0].name,
      },
      created_by: updateResult.rows[0].created_by,
      updated_by: updateResult.rows[0].updated_by,
      created_at: updateResult.rows[0].created_at,
      updated_at: updateResult.rows[0].updated_at,
    };

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(responseData),
      "Survey template question updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating survey template question:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
