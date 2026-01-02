const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createJobColorColumnSection = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const { section_name, sort_order } = req.body;

    const attachments = (req.body.image ?? req.body.attachments_pdf) || null;

    if (!section_name) {
      return errorResponse(res, 400, "Section name is required.");
    }

    await client.query("BEGIN");

    const settingsQuery = `
      SELECT job_color_settings_id
      FROM job_color_settings
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1;
    `;
    const settingsResult = await client.query(settingsQuery, [
      builderId,
      companyId,
    ]);

    if (settingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Job color settings not found.");
    }

    const jobColorSettingsId = settingsResult.rows[0].job_color_settings_id;

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_color_column_sections
      WHERE job_color_settings_id = $1;
    `;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      jobColorSettingsId,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`
      );
    }

    const shiftSortOrderQuery = `
      UPDATE job_color_column_sections
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND job_color_settings_id = $2;
    `;

    await client.query(shiftSortOrderQuery, [
      finalSortOrder,
      jobColorSettingsId,
    ]);

    const insertQuery = `
      INSERT INTO job_color_column_sections (
        job_color_settings_id,
        section_name,
        attachments,
        sort_order
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      jobColorSettingsId,
      section_name,
      attachments,
      finalSortOrder,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job color column section created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return errorResponse(res, 500, err.message);
  } finally {
    client.release();
  }
};

exports.getJobColorColumnSections = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const settingsQuery = `
      SELECT job_color_settings_id
      FROM job_color_settings
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1;
    `;

    const settingsResult = await client.query(settingsQuery, [
      builderId,
      companyId,
    ]);

    if (settingsResult.rowCount === 0) {
      return errorResponse(res, 400, "Job color settings not found.");
    }

    const jobColorSettingsId = settingsResult.rows[0].job_color_settings_id;

    const dataQuery = `
      SELECT
        job_color_column_section_id,
        section_name,
        attachments,
        sort_order
      FROM job_color_column_sections
      WHERE job_color_settings_id = $1
      ORDER BY sort_order ASC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      jobColorSettingsId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM job_color_column_sections
      WHERE job_color_settings_id = $1;
    `;

    const countResult = await client.query(countQuery, [jobColorSettingsId]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(res, {
      JobColorColumnSections: keysToCamelCase(dataResult.rows),
      pagination: {
        currentPage: pageValue,
        totalPages,
        totalRecords,
        limit: limitValue,
      },
    });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteJobColorColumnSection = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const { job_color_column_section_id } = req.params;

    if (!job_color_column_section_id) {
      return errorResponse(res, 400, "Section ID is required.");
    }

    await client.query("BEGIN");

    const settingsQuery = `
      SELECT job_color_settings_id
      FROM job_color_settings
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1;
    `;

    const settingsResult = await client.query(settingsQuery, [
      builderId,
      companyId,
    ]);

    if (settingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Job color settings not found.");
    }

    const jobColorSettingsId = settingsResult.rows[0].job_color_settings_id;

    const sectionQuery = `
      SELECT sort_order
      FROM job_color_column_sections
      WHERE job_color_column_section_id = $1
        AND job_color_settings_id = $2;
    `;

    const sectionResult = await client.query(sectionQuery, [
      job_color_column_section_id,
      jobColorSettingsId,
    ]);

    if (sectionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Section not found.");
    }

    const deletedSortOrder = sectionResult.rows[0].sort_order;

    const deleteQuery = `
      DELETE FROM job_color_column_sections
      WHERE job_color_column_section_id = $1
        AND job_color_settings_id = $2;
    `;

    await client.query(deleteQuery, [
      job_color_column_section_id,
      jobColorSettingsId,
    ]);

    const reorderQuery = `
      UPDATE job_color_column_sections
      SET sort_order = sort_order - 1
      WHERE job_color_settings_id = $1
        AND sort_order > $2;
    `;

    await client.query(reorderQuery, [jobColorSettingsId, deletedSortOrder]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Job color column section deleted successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobColorColumnSection = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { job_color_column_section_id } = req.params;

    let { section_name, sort_order } = req.body;
    const attachments = (req.body.image ?? req.body.attachments_pdf) || null;

    if (!job_color_column_section_id) {
      return errorResponse(res, 400, "Section ID is required.");
    }

    await client.query("BEGIN");

    const settingsQuery = `
      SELECT job_color_settings_id
      FROM job_color_settings
      WHERE builder_id = $1 OR company_id = $2
      LIMIT 1;
    `;
    const settingsResult = await client.query(settingsQuery, [
      builderId,
      companyId,
    ]);

    if (settingsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Job color settings not found.");
    }

    const jobColorSettingsId = settingsResult.rows[0].job_color_settings_id;

    const sectionQuery = `
      SELECT * 
      FROM job_color_column_sections
      WHERE job_color_column_section_id = $1
        AND job_color_settings_id = $2
    `;
    const sectionResult = await client.query(sectionQuery, [
      job_color_column_section_id,
      jobColorSettingsId,
    ]);

    if (sectionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Section not found.");
    }

    const existingSection = sectionResult.rows[0];

    const oldSortOrder = existingSection.sort_order;
    let newSortOrder = sort_order;

    if (newSortOrder !== undefined && newSortOrder !== null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM job_color_column_sections
        WHERE job_color_settings_id = $1
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        jobColorSettingsId,
      ]);
      const maxSort = maxSortResult.rows[0].max_sort;

      if (newSortOrder < 1 || newSortOrder > maxSort) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSort}.`
        );
      }

      if (newSortOrder !== oldSortOrder) {
        if (newSortOrder > oldSortOrder) {
          await client.query(
            `
            UPDATE job_color_column_sections
            SET sort_order = sort_order - 1
            WHERE job_color_settings_id = $1
              AND sort_order > $2
              AND sort_order <= $3
              AND job_color_column_section_id != $4
          `,
            [
              jobColorSettingsId,
              oldSortOrder,
              newSortOrder,
              job_color_column_section_id,
            ]
          );
        } else {
          await client.query(
            `
            UPDATE job_color_column_sections
            SET sort_order = sort_order + 1
            WHERE job_color_settings_id = $1
              AND sort_order >= $2
              AND sort_order < $3
              AND job_color_column_section_id != $4
          `,
            [
              jobColorSettingsId,
              newSortOrder,
              oldSortOrder,
              job_color_column_section_id,
            ]
          );
        }
      }
    }

    if (
      !section_name &&
      attachments === undefined &&
      newSortOrder === undefined
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field (section_name, attachments, or sort_order) is required to update."
      );
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (section_name) {
      fields.push(`section_name = $${i++}`);
      values.push(section_name);
    }

    let updatedAttachments = existingSection.attachments;
    if (attachments !== undefined) {
      if (!attachments) {
        fields.push(`attachments = $${i++}`);
        values.push(null);
      } else {
        if (
          existingSection.attachments &&
          existingSection.attachments !== attachments
        ) {
          await deleteFromS3(existingSection.attachments);
        }
        fields.push(`attachments = $${i++}`);
        values.push(attachments);
        updatedAttachments = attachments;
      }
    }

    if (newSortOrder !== undefined) {
      fields.push(`sort_order = $${i++}`);
      values.push(newSortOrder);
    }

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE job_color_column_sections
      SET ${fields.join(", ")}
      WHERE job_color_column_section_id = $${i}
        AND job_color_settings_id = $${i + 1}
      RETURNING *;
    `;
    values.push(job_color_column_section_id, jobColorSettingsId);

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Job color column section updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
