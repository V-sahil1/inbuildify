const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createEstateStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_id, name, release_date } = req.body;
    const attach_files = req.files?.attachFile?.map(file => file.location) || 
                      (req.body.attach_file ? [req.body.attach_file] : []);
    
    const builderId = req.user?.builder_id;

    const estateCheck = await client.query(
      `SELECT estate_id 
       FROM estate 
       WHERE estate_id = $1 AND builder_id = $2`,
      [estate_id, builderId],
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Estate not found or you do not have permission.",
      );
    }

    const estateActiveCheck = await client.query(
      `SELECT estate_id 
       FROM estate 
       WHERE estate_id = $1 AND builder_id = $2 AND status = 'true'`,
      [estate_id, builderId],
    );

    if (estateActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive Estate.");
    }

    const dupCheck = await client.query(
      `SELECT estate_stage_id
       FROM estate_stages
       WHERE estate_id = $1 AND LOWER(name) = LOWER($2)`,
      [estate_id, name],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Stage name already exists for this estate.",
      );
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (release_date && !isValidDate(release_date)) {
      return errorResponse(res, 400, `Invalid date: ${release_date}`);
    }

    const result = await client.query(
      `INSERT INTO estate_stages 
        (estate_id, name, release_date, attach_file)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [estate_id, name, release_date || null, attach_files.length > 0 ? attach_files : null],
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Estate stage created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create estate stage error:", err);
    return errorResponse(res, 500, "Failed to create estate stage.");
  } finally {
    client.release();
  }
};

exports.getAllEstateStages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    const { page = 1, limit = 25, estate_id } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    let whereClause = `WHERE e.builder_id = $1`;
    let values = [builderId];
    let paramIndex = 2;

    if (estate_id) {
      whereClause += ` AND e.estate_id = $${paramIndex}`;
      values.push(estate_id);
      paramIndex++;
    }

    const countResult = await client.query(
      `SELECT COUNT(es.estate_stage_id) AS total
       FROM estate_stages es
       JOIN estate e ON e.estate_id = es.estate_id
       ${whereClause}`,
      values,
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNumber);

    const result = await client.query(
      `SELECT es.*
       FROM estate_stages es
       JOIN estate e ON e.estate_id = es.estate_id
       ${whereClause}
       ORDER BY es.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limitNumber, offset],
    );

    return successResponse(res, {
      estateStage: keysToCamelCase(result.rows),
      pagination: {
        totalRecords: total,
        currentPage: pageNumber,
        limit: limitNumber,
        totalPages,
      },
    });
  } catch (err) {
    console.error("Get all estate stages error:", err);
    return errorResponse(res, 500, "Failed to fetch estate stages.");
  } finally {
    client.release();
  }
};

exports.deleteEstateStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_stage_id } = req.params;
    const builderId = req.user?.builder_id;

    const stageCheck = await client.query(
      `SELECT estate_id 
       FROM estate_stages
       WHERE estate_stage_id = $1`,
      [estate_stage_id],
    );

    if (stageCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate stage not found.");
    }

    const estateId = stageCheck.rows[0].estate_id;

    const estateCheck = await client.query(
      `SELECT estate_id
       FROM estate
       WHERE estate_id = $1 AND builder_id = $2`,
      [estateId, builderId],
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not allowed to delete stages from this estate.",
      );
    }

    await client.query(
      `DELETE FROM estate_stages
       WHERE estate_stage_id = $1`,
      [estate_stage_id],
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Estate stage deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete estate stage error:", err);
    return errorResponse(res, 500, "Failed to delete estate stage.");
  } finally {
    client.release();
  }
};

exports.updateEstateStage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { estate_stage_id } = req.params;
    const { name, release_date, attach_file } = req.body;
    const uploadedFiles = req.files?.attachFile?.map(file => file.location) || [];

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT estate_id, name, attach_file FROM estate_stages WHERE estate_stage_id = $1`,
      [estate_stage_id],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate stage not found");
    }

    const estateId = existing.rows[0].estate_id;
    const oldName = existing.rows[0].name;
    const existingFiles = existing.rows[0].attach_file || [];

    // const estateCheck = await client.query(
    //   `SELECT estate_id FROM estate WHERE estate_id = $1 AND builder_id = $2`,
    //   [estateId, builderId],
    // );

    // if (estateCheck.rowCount === 0) {
    //   await client.query("ROLLBACK");
    //   return errorResponse(res, 404, "Estate not found");
    // }

    // const estateActiveCheck = await client.query(
    //   `SELECT estate_id FROM estate WHERE estate_id = $1 AND builder_id = $2 ANd status = 'true'`,
    //   [estateId, builderId],
    // );

    // if (estateActiveCheck.rowCount === 0) {
    //   await client.query("ROLLBACK");
    //   return errorResponse(res, 404, "Inactive estate");
    // }

    if (name && name !== oldName) {
      const dupCheck = await client.query(
        `SELECT 1 FROM estate_stages 
         WHERE estate_id = $1 AND name = $2 AND estate_stage_id != $3`,
        [estateId, name, estate_stage_id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Stage name already exists for this estate",
        );
      }
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (release_date && !isValidDate(release_date)) {
      return errorResponse(res, 400, `Invalid date: ${release_date}`);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (release_date) {
      fields.push(`release_date = $${idx++}`);
      values.push(release_date);
    }

    
    // Handle file updates for multiple files
    let updatedFiles = existingFiles;
    
    if (attach_file !== undefined) {
      // If attach_file is provided in body (string or JSON array), use it
      if (attach_file === null || attach_file === '') {
        // Remove all files if null is provided
        if (existingFiles.length > 0) {
          for (const fileUrl of existingFiles) {
            await deleteFromS3(fileUrl);
          }
        }
        fields.push(`attach_file = $${idx++}`);
        values.push(null);
        updatedFiles = [];
      } else if (typeof attach_file === 'string') {
        // Handle single string or JSON array string
        try {
          const parsedFiles = JSON.parse(attach_file);
          const newFiles = Array.isArray(parsedFiles) ? parsedFiles : [attach_file];
          
          // Delete old files that are not in the new list
          for (const oldFile of existingFiles) {
            if (!newFiles.includes(oldFile)) {
              await deleteFromS3(oldFile);
            }
          }
          
          fields.push(`attach_file = $${idx++}`);
          values.push(newFiles);
          updatedFiles = newFiles;
        } catch {
          // If parsing fails, treat as single file
          const newFiles = [attach_file];
          
          // Delete old files that are not the new file
          for (const oldFile of existingFiles) {
            if (oldFile !== attach_file) {
              await deleteFromS3(oldFile);
            }
          }
          
          fields.push(`attach_file = $${idx++}`);
          values.push(newFiles);
          updatedFiles = newFiles;
        }
      }
    } else if (uploadedFiles.length > 0) {
      // Handle new file uploads
      // Delete old files
      if (existingFiles.length > 0) {
        for (const fileUrl of existingFiles) {
          await deleteFromS3(fileUrl);
        }
      }
      
      fields.push(`attach_file = $${idx++}`);
      values.push(uploadedFiles);
      updatedFiles = uploadedFiles;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Nothing to update");
    }

    fields.push(`updated_at = NOW()`);

    const query = `
      UPDATE estate_stages
      SET ${fields.join(", ")}
      WHERE estate_stage_id = $${idx}
      RETURNING *;
    `;
    values.push(estate_stage_id);

    const updated = await client.query(query, values);

    await client.query("COMMIT");

    const finalData = {
      ...updated.rows[0],
      attach_file: updatedFiles,
    };

    return successResponse(
      res,
      keysToCamelCase(finalData),
      "Estate stage updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating estate stage:", error);
    return errorResponse(res, 500, "Something went wrong");
  } finally {
    client.release();
  }
};
