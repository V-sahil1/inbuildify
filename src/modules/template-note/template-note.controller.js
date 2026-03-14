const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createTemplateNote = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const { name, content, is_active } = req.body;

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Name is required.");
    }

    const duplicateCheckQuery = `
      SELECT template_note_id
      FROM template_note
      WHERE LOWER(name) = LOWER($1)
        AND (
          (builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3)
        )
      LIMIT 1
    `;
    const duplicateResult = await client.query(duplicateCheckQuery, [
      name.trim(),
      builderId,
      companyId,
    ]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "A template note with this name already exists for this builder/company."
      );
    }

    const insertQuery = `
      INSERT INTO template_note (
        company_id,
        builder_id,
        name,
        content,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const insertValues = [
      companyId,
      builderId,
      name.trim(),
      content || null,
      is_active || true,
      userId,
      userId,
    ];

    const insertResult = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Template note created successfully."
    );
  } catch (error) {
    console.error("Error creating template note:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getAllTemplateNotes = async (req, res) => {
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
      FROM template_note tn
      WHERE tn.builder_id = $1
      ORDER BY tn.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM template_note
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        templateNotes: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Template notes fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching template notes:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteTemplateNote = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { template_note_id } = req.params;
    const builderId = req.user.builder_id;

    const checkQuery = `
      SELECT template_note_id
      FROM template_note
      WHERE template_note_id = $1
        AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      template_note_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Template note not found or unauthorized to delete."
      );
    }

    const deleteQuery = `
      DELETE FROM template_note
      WHERE template_note_id = $1
        AND builder_id = $2
      RETURNING *;
    `;
    const deleteResult = await client.query(deleteQuery, [
      template_note_id,
      builderId,
    ]);

    return successResponse(res, null, "Template note deleted successfully.");
  } catch (error) {
    console.error("Error deleting template note:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateTemplateNote = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { template_note_id } = req.params;
    const builderId = req.user.builder_id;
    const userId = req.user.users_id;

    const { name, content } = req.body;

    const checkQuery = `
      SELECT *
      FROM template_note
      WHERE template_note_id = $1
        AND builder_id = $2;
    `;
    const checkResult = await client.query(checkQuery, [
      template_note_id,
      builderId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Template note not found or unauthorized to update."
      );
    }

    const checkActiveQuery = `
      SELECT *
      FROM template_note
      WHERE template_note_id = $1
        AND builder_id = $2 AND is_active = true;
    `;
    const checkActiveResult = await client.query(checkActiveQuery, [
      template_note_id,
      builderId,
    ]);

    if (checkActiveResult.rows.length === 0) {
      return errorResponse(res, 404, "Template note is inactive.");
    }

    // const currentIsActive = checkResult.rows[0].is_active;

    // const updatingOtherFields = name || content;
    // const requestedIsActiveTrue = is_active === true || is_active === "true";
    // const requestedIsActiveFalse = is_active === false || is_active === "false";

    // if (!updatingOtherFields && is_active === undefined) {
    //   return errorResponse(res, 400, "No valid fields provided for update.");
    // }

    // if (currentIsActive === true && is_active !== undefined) {
    //   if (requestedIsActiveFalse) {
    //     if (updatingOtherFields) {
    //       return errorResponse(
    //         res,
    //         403,
    //         "To deactivate an active note template, 'is_active' must be the only field provided in the request."
    //       );
    //     }
    //   }
    // }
    // if (currentIsActive === false) {
    //   if (requestedIsActiveTrue) {
    //     if (updatingOtherFields) {
    //       return errorResponse(
    //         res,
    //         403,
    //         "To activate an inactive note template, 'is_active' must be the only field provided in the request."
    //       );
    //     }
    //   }

    //   if (updatingOtherFields) {
    //     return errorResponse(
    //       res,
    //       403,
    //       "Cannot update non-'is_active' fields when the note template is currently inactive. Only 'is_active' can be changed (to true)."
    //     );
    //   }

    //   if (is_active !== undefined) {
    //     if (requestedIsActiveFalse) {
    //       return errorResponse(
    //         res,
    //         403,
    //         "Note template is already inactive. 'is_active' can only be updated to true from this state."
    //       );
    //     }
    //   }
    // }

    if (name) {
      const duplicateQuery = `
        SELECT template_note_id
        FROM template_note
        WHERE LOWER(name) = LOWER($1)
          AND builder_id = $2
          AND template_note_id != $3;
      `;
      const duplicateResult = await client.query(duplicateQuery, [
        name.trim(),
        builderId,
        template_note_id,
      ]);

      if (duplicateResult.rows.length > 0) {
        return errorResponse(
          res,
          400,
          "A template note with this name already exists."
        );
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (content) {
      fields.push(`content = $${paramIndex++}`);
      values.push(content.trim());
    }
    // if (is_active !== undefined) {
    //   fields.push(`is_active = $${paramIndex++}`);
    //   values.push(is_active);
    // }

    fields.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE template_note
      SET ${fields.join(", ")}
      WHERE template_note_id = $${paramIndex++}
        AND builder_id = $${paramIndex}
      RETURNING *;
    `;
    values.push(template_note_id, builderId);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Template note updated successfully."
    );
  } catch (error) {
    console.error("Error updating template note:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateTemplateNoteIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const { template_note_id } = req.params;

    if (!template_note_id) {
      return errorResponse(res, 400, "template_note_id is required");
    }

    const existing = await client.query(
      `
      SELECT template_note_id, is_active
      FROM template_note
      WHERE template_note_id = $1
        AND (
          builder_id = $2
          OR company_id = $3
        )
      `,
      [template_note_id, builderId, companyId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Template note not found in your scope");
    }

    const currentStatus = existing.rows[0].is_active;
    const newStatus = !currentStatus;

    const updateQuery = `
      UPDATE template_note
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE template_note_id = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      newStatus,
      userId,
      template_note_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      `Template note status updated successfully to ${newStatus ? 'active' : 'inactive'}`
    );
  } catch (error) {
    console.error("Error updating template note is_active:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
