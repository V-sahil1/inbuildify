const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createSurveyTemplateQuestion = async (req, res) => {
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

    if (option_type === "radio") {
      if (!options || !Array.isArray(options) || options.length === 0) {
        return errorResponse(
          res,
          400,
          "options array is required when option_type = radio."
        );
      }
    } else {
      if (options && options.length > 0) {
        return errorResponse(
          res,
          400,
          "options are allowed only when option_type = radio."
        );
      }
    }

    const checkTemplateQuery = `
      SELECT survey_template_id 
      FROM survey_template
      WHERE survey_template_id = $1 AND builder_id = $2;
    `;
    const checkTemplateResult = await client.query(checkTemplateQuery, [
      survey_template_id,
      builderId,
    ]);

    if (checkTemplateResult.rowCount === 0) {
      return errorResponse(
        res,
        403,
        "Survey template does not belong to this builder."
      );
    }

    if (survey_template_id) {
      const surveyTemplateCheck = await client.query(
        `SELECT survey_template_id 
     FROM survey_template
     WHERE builder_id = $1 
       AND survey_template_id = $2 
       AND status = true`,
        [builderId, survey_template_id]
      );

      if (surveyTemplateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "survey template id is inactive.");
      }
    }

    const checkSortQuery = `
      SELECT survey_question_id 
      FROM survey_template_questions
      WHERE survey_template_id = $1 AND sort_order = $2;
    `;
    const checkSortResult = await client.query(checkSortQuery, [
      survey_template_id,
      sort_order || 0,
    ]);

    if (checkSortResult.rowCount > 0) {
      return errorResponse(res, 409, "Duplicate sort_order for this template.");
    }

    const insertQuery = `
      INSERT INTO survey_template_questions (
        survey_template_id,
        description,
        option_type,
        options,
        sort_order,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const insertValues = [
      survey_template_id,
      description,
      option_type,
      option_type === "radio" ? options : null,
      sort_order || 0,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Survey template question created successfully."
    );
  } catch (error) {
    console.error("Create Survey Question Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllSurveyTemplateQuestions = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT q.*
      FROM survey_template_questions q
      JOIN survey_template t
        ON q.survey_template_id = t.survey_template_id
      WHERE t.builder_id = $1
      ORDER BY q.sort_order ASC
      LIMIT $2 OFFSET $3;
    `;
    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM survey_template_questions q
      JOIN survey_template t
        ON q.survey_template_id = t.survey_template_id
      WHERE t.builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        questions: keysToCamelCase(dataResult.rows),
        pagination: {
          total_records: totalRecords,
          current_page: pageValue,
          total_pages: totalPages,
          limit: limitValue,
        },
      },
      "Survey template questions fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching survey template questions:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSurveyTemplateQuestion = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { survey_question_id } = req.params;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const checkQuery = `
      SELECT q.survey_question_id
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
        "Survey template question not found or not owned by this builder."
      );
    }

    const deleteQuery = `
      DELETE FROM survey_template_questions
      WHERE survey_question_id = $1;
    `;
    await client.query(deleteQuery, [survey_question_id]);

    return successResponse(
      res,
      null,
      "Survey template question deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting survey template question:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSurveyTemplateQuestion = async (req, res) => {
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
        "Survey template question not found or not owned by this builder."
      );
    }

    const surveyTemplateId = checkResult.rows[0].survey_template_id;
    const currentOptionType = checkResult.rows[0].option_type;

    if (sort_order !== undefined) {
      const duplicateSortQuery = `
        SELECT survey_question_id
        FROM survey_template_questions
        WHERE survey_template_id = $1
          AND sort_order = $2
          AND survey_question_id <> $3;
      `;
      const duplicateSortResult = await client.query(duplicateSortQuery, [
        surveyTemplateId,
        sort_order,
        survey_question_id,
      ]);

      if (duplicateSortResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Sort order ${sort_order} already exists for this survey template.`
        );
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
          `Invalid option_type. Must be one of: ${validTypes.join(", ")}`
        );
      }

      setClauses.push(`option_type = $${idx++}`);
      values.push(option_type);
      newOptionType = option_type;

      if (option_type !== "radio") {
        setClauses.push(`options = NULL`);
      }
    }

    if (options !== undefined) {
      if (newOptionType !== "radio") {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Options can only be updated when option_type is radio."
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

    setClauses.push(`updated_at = NOW()`);
    values.push(survey_question_id);

    const updateQuery = `
      UPDATE survey_template_questions
      SET ${setClauses.join(", ")}
      WHERE survey_question_id = $${idx}
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Survey template question updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating survey template question:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
