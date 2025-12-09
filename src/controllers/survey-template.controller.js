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

    const { name, sort_order, is_recommended, status } = req.body || {};

    const duplicateNameQuery = `
    SELECT survey_template_id 
    FROM survey_template
    WHERE company_id = $1 
    AND builder_id = $2
    AND LOWER(name) = $3;
    `;

    const duplicateNameResult = await client.query(duplicateNameQuery, [
      companyId,
      builderId,
      name.toLowerCase(),
    ]);

    if (duplicateNameResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Survey template with this name already exists."
      );
    }

    const finalSortOrder = sort_order ?? 0;

    const duplicateSortQuery = `
      SELECT survey_template_id 
      FROM survey_template
      WHERE company_id = $1
        AND builder_id = $2
        AND sort_order = $3;
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
        `Sort Order ${finalSortOrder} already exists.`
      );
    }

    const insertQuery = `
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const insertValues = [
      companyId,
      builderId,
      name,
      finalSortOrder,
      is_recommended || false,
      status || true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Survey template created successfully."
    );
  } catch (error) {
    console.error("Create Survey Template Error:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Survey template with this name already exists."
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
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
        *
      FROM survey_template
      WHERE builder_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM survey_template
      WHERE builder_id = $1;
    `;

    const countResult = await client.query(countQuery, [builderId]);
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
      "Survey templates fetched successfully."
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
      SELECT survey_template_id 
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
        "Record not found or you are not allowed to delete this record."
      );
    }

    const deleteQuery = `
      DELETE FROM survey_template 
      WHERE survey_template_id = $1 AND builder_id = $2
    `;

    await client.query(deleteQuery, [survey_template_id, builderId]);

    return successResponse(
      res,
      200,
      "Survey template deleted successfully.",
      null
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
        "Record not found or you are not allowed to update this record."
      );
    }

    const oldTemplate = checkResult.rows[0];
    const currentStatus = oldTemplate.status;
    const statusInBody = req.body.status !== undefined;
    const requestedStatus = status;

    const fieldsToCheck = ["name", "sort_order", "is_recommended"];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'status' field must be a boolean (true or false)."
      );
    }

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active survey template, 'status' must be the only field provided in the request."
        );
      }
    }

    if (currentStatus === false) {
      if (statusInBody && requestedStatus === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive survey template, 'status' must be the only field provided in the request."
          );
        }
      }

      const performingActivation = statusInBody && requestedStatus === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'status' fields when the survey template is currently Inactive. Only 'status' can be changed (to true/Active)."
        );
      }

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Survey template is already Inactive. 'status' can only be updated to true (Active) from this state."
        );
      }
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
          "Survey template name already exists for this builder."
        );
      }
    }

    if (sort_order !== undefined) {
      const sortQuery = `
        SELECT survey_template_id
        FROM survey_template
        WHERE sort_order = $1
          AND builder_id = $2
          AND builder_id IS NOT NULL
          AND survey_template_id != $3
      `;
      const sortResult = await client.query(sortQuery, [
        sort_order,
        builderId,
        survey_template_id,
      ]);

      if (sortResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Duplicate sort_order is not allowed for this builder."
        );
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
    if (is_recommended !== undefined) push("is_recommended", is_recommended);

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
      "Survey template updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Survey Template Error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
};
