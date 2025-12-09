const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.getAllRanges = async (req, res) => {
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
      FROM range
      WHERE builder_id = $1
      ORDER BY sort_order ASc
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM range
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        ranges: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Ranges fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching ranges:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.createRange = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;

    let { name, user_id, sort_order, bg_color, font_color, is_active } =
      req.body;

    const logo_image = req.body.logo_image || null;
    const header_image = req.body.header_image || null;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    await client.query("BEGIN");

    let userIdArray = [];

    if (user_id) {
      if (Array.isArray(user_id)) {
        userIdArray = user_id;
      } else if (typeof user_id === "string") {
        // JSON string array → ["id1","id2"]
        if (user_id.trim().startsWith("[")) {
          userIdArray = JSON.parse(user_id);
        } else {
          // CSV → "id1,id2,id3"
          userIdArray = user_id.split(",").map((x) => x.trim());
        }
      }
    }

    // If empty, set null
    if (userIdArray.length === 0) {
      userIdArray = null;
    }

    if (userIdArray) {
      const checkQuery = `
        SELECT users_id 
        FROM users 
        WHERE users_id = ANY($1::uuid[]) AND is_deleted = false
      `;

      const check = await client.query(checkQuery, [userIdArray]);

      if (check.rowCount !== userIdArray.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "One or more user IDs are invalid.");
      }
    }

    const dupCheck = await client.query(
      `SELECT range_id FROM range WHERE builder_id = $1 AND LOWER(name) = LOWER($2)`,
      [builderId, name]
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Range name already exists.");
    }

    const finalSort = sort_order ?? 1;

    const sortCheck = await client.query(
      `SELECT 1 FROM range WHERE sort_order = $1 AND builder_id = $2`,
      [finalSort, builderId]
    );

    if (sortCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        `Sort order ${finalSort} already exists for this builder.`
      );
    }

    const insertQuery = `
      INSERT INTO range (
        company_id,
        builder_id,
        name,
        logo_url,
        header_url,
        user_id,
        sort_order,
        bg_color,
        font_color,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name,
      logo_image,
      header_image,
      userIdArray,
      finalSort,
      bg_color || null,
      font_color || null,
      is_active ?? true,
      createdBy,
      createdBy,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Range created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating range:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateRange = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { range_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    let { name, user_id, sort_order, bg_color, font_color, is_active } =
      req.body;

    const logo_image = req.body.logo_image || null;
    const header_image = req.body.header_image || null;

    const updatingOtherFields =
      name ||
      user_id ||
      sort_order !== undefined ||
      bg_color ||
      font_color ||
      req.body.logo_image !== undefined ||
      req.body.header_image !== undefined;

    await client.query("BEGIN");

    const rangeCheck = await client.query(
      `SELECT * FROM range WHERE range_id = $1 AND builder_id = $2`,
      [range_id, builderId]
    );

    if (rangeCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Range not found for this builder.");
    }

    const existingRange = rangeCheck.rows[0];
    const currentIsActive = existingRange.is_active;

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To deactivate an active range, 'is_active' must be the only field provided in the request."
          );
        }
      }
    }

    if (currentIsActive === false) {
      if (requestedIsActiveTrue) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive range, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the range is currently inactive. Only 'is_active' can be changed (to true)."
        );
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "Range is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (user_id) {
      try {
        //  JSON array string → '["id1","id2"]'
        if (typeof user_id === "string" && user_id.trim().startsWith("[")) {
          user_id = JSON.parse(user_id);
        }
        //  "{id}" or '{"id"}'
        else if (
          typeof user_id === "string" &&
          user_id.startsWith("{") &&
          user_id.endsWith("}")
        ) {
          user_id = [user_id.replace(/[{}"]/g, "")];
        }
        //  CSV
        else if (typeof user_id === "string" && user_id.includes(",")) {
          user_id = user_id.split(",").map((x) => x.trim());
        }
        //  Single string UUID
        else if (typeof user_id === "string") {
          user_id = [user_id.trim()];
        }
        // Already array
        else if (!Array.isArray(user_id)) {
          return errorResponse(res, 400, "Invalid user_id format.");
        }
      } catch (e) {
        return errorResponse(res, 400, "Invalid user_id format.");
      }
    }

    if (user_id && user_id.length > 0) {
      const userCheck = await client.query(
        `SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND is_deleted = false`,
        [user_id]
      );

      if (userCheck.rowCount !== user_id.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more user IDs are invalid or do not exist."
        );
      }
    }

    if (name) {
      const dupName = await client.query(
        `SELECT 1 FROM range 
         WHERE builder_id = $1 
         AND LOWER(name) = LOWER($2) 
         AND range_id != $3`,
        [builderId, name.trim(), range_id]
      );

      if (dupName.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Range name already exists.");
      }
    }

    if (sort_order !== undefined) {
      const dupSort = await client.query(
        `SELECT 1 FROM range 
         WHERE builder_id = $1 
         AND sort_order = $2 
         AND range_id != $3`,
        [builderId, sort_order, range_id]
      );

      if (dupSort.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Sort order ${sort_order} already exists for this builder.`
        );
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (name) {
      fields.push(`name = $${i++}`);
      values.push(name.trim());
    }

    if (user_id) {
      fields.push(`user_id = $${i++}`);
      values.push(user_id);
    }

    if (sort_order !== undefined) {
      fields.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }

    if (bg_color) {
      fields.push(`bg_color = $${i++}`);
      values.push(bg_color);
    }

    if (font_color) {
      fields.push(`font_color = $${i++}`);
      values.push(font_color);
    }

    if (is_active !== undefined) {
      fields.push(`is_active = $${i++}`);
      values.push(is_active);
    }

    let updatedLogoUrl = existingRange.logo_url;
    if (logo_image !== undefined) {
      if (!logo_image) {
        fields.push(`logo_url = $${i++}`);
        values.push(null);
      } else {
        if (existingRange.logo_url && existingRange.logo_url !== logo_image) {
          await deleteFromS3(existingRange.logo_url);
        }
        fields.push(`logo_url = $${i++}`);
        values.push(logo_image);
      }
    }

    let updatedHeaderUrl = existingRange.header_url;
    if (header_image !== undefined) {
      if (!header_image) {
        fields.push(`header_url = $${i++}`);
        values.push(null);
      } else {
        if (
          existingRange.header_url &&
          existingRange.header_url !== header_image
        ) {
          await deleteFromS3(existingRange.header_url);
        }
        fields.push(`header_url = $${i++}`);
        values.push(header_image);
      }
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE range
      SET ${fields.join(", ")}
      WHERE range_id = $${i} AND builder_id = $${i + 1}
      RETURNING *;
    `;

    values.push(range_id, builderId);

    const updateResult = await client.query(updateQuery, values);
    await client.query("COMMIT");

    const finalData = {
      ...updateResult.rows[0],
      logo_url: updatedLogoUrl,
      header_url: updatedHeaderUrl,
    };

    return successResponse(
      res,
      keysToCamelCase(finalData),
      "Range updated successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating range:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteRange = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { range_id } = req.params;
  const builderId = req.user.builder_id;
  try {
    const checkRangeExists = await client.query(
      `SELECT * FROM range WHERE range_id = $1 AND builder_id = $2`,
      [range_id, builderId]
    );
    if (checkRangeExists.rowCount === 0) {
      return errorResponse(res, 404, "Range not found for this builder");
    }

    const query = `DELETE FROM range WHERE range_id = $1 AND builder_id = $2`;

    const result = await client.query(query, [range_id, builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Range deleted successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
