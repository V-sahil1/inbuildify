import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createFunctionality(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { screen_id, name } = req.body;

    if (!screen_id || !name) {
      return errorResponse(res, 400, "screen_id and name are required");
    }

    const validateScreenQuery = `
      SELECT screen_id
      FROM screen
      WHERE screen_id = $1;
    `;

    const validateScreen = await client.query(validateScreenQuery, [screen_id]);

    if (validateScreen.rowCount === 0) {
      return errorResponse(res, 404, "Screen not found.");
    }

    const duplicateCheckQuery = `
      SELECT functionality_id
      FROM functionality
      WHERE screen_id = $1
        AND LOWER(name) = LOWER($2)
      LIMIT 1;
    `;

    const duplicateResult = await client.query(duplicateCheckQuery, [
      screen_id,
      name.trim(),
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Functionality with this name already exists for this screen.",
      );
    }

    const insertQuery = `
      INSERT INTO functionality (
        screen_id,
        name
      )
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [screen_id, name.trim()]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Functionality created successfully.",
      201,
    );
  } catch (error) {
    console.error("Error creating functionality:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getFunctionalities(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const dataQuery = `
      SELECT 
        f.functionality_id,
        f.name AS functionality_name,
        json_build_object('id', s.screen_id, 'name', s.name) AS screen
      FROM functionality f
      JOIN screen s ON s.screen_id = f.screen_id
      ORDER BY f.created_at DESC;
    `;

    const dataResult = await client.query(dataQuery);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
      "Functionalities fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching functionalities:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteFunctionality(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { functionality_id } = req.params;

    if (!functionality_id) {
      return errorResponse(res, 400, "Functionality ID is required.");
    }

    const existingFunctionality = await client.query(
      `SELECT functionality_id 
       FROM functionality 
       WHERE functionality_id = $1`,
      [functionality_id],
    );

    if (existingFunctionality.rowCount === 0) {
      return errorResponse(res, 404, "Functionality not found.");
    }

    await client.query(
      "DELETE FROM functionality WHERE functionality_id = $1",
      [functionality_id],
    );

    return successResponse(res, null, "Functionality deleted successfully.");
  } catch (error) {
    console.error("Error deleting functionality:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateFunctionality(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { functionality_id } = req.params;
    const builderId = req.user.builder_id;

    const { name, screen_id } = req.body;

    const existingResult = await client.query(
      `
      SELECT functionality_id, screen_id, name
      FROM functionality
      WHERE functionality_id = $1
        AND builder_id = $2
      `,
      [functionality_id, builderId],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Functionality not found for this builder.",
      );
    }

    const existing = existingResult.rows[0];

    const finalScreenId = screen_id || existing.screen_id;

    if (screen_id) {
      const checkScreenQuery = `
        SELECT screen_id
        FROM screen
        WHERE screen_id = $1
          AND builder_id = $2;
      `;
      const checkResult = await client.query(checkScreenQuery, [
        screen_id,
        builderId,
      ]);

      if (checkResult.rowCount === 0) {
        return errorResponse(
          res,
          404,
          "Screen not found or you are not authorized to update this screen.",
        );
      }
    }

    const finalName = name || existing.name;

    if (name || screen_id) {
      const duplicateCheckQuery = `
        SELECT functionality_id
        FROM functionality
        WHERE screen_id = $1
          AND name = $2
          AND functionality_id <> $3
          AND builder_id = $4
        LIMIT 1;
      `;

      const duplicateResult = await client.query(duplicateCheckQuery, [
        finalScreenId,
        finalName.trim(),
        functionality_id,
        builderId,
      ]);

      if (duplicateResult.rowCount > 0) {
        return errorResponse(
          res,
          409,
          "Functionality with this name already exists for this screen.",
        );
      }
    }

    const updateFields = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${index}`);
      values.push(name.trim());
      index++;
    }

    if (screen_id !== undefined) {
      updateFields.push(`screen_id = $${index}`);
      values.push(screen_id);
      index++;
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    updateFields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE functionality
      SET ${updateFields.join(", ")}
      WHERE functionality_id = $${index}
        AND builder_id = $${index + 1}
      RETURNING *;
    `;

    values.push(functionality_id, builderId);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Functionality updated successfully.",
    );
  } catch (error) {
    console.error("Error updating functionality:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Functionality with this name already exists.",
      );
    }

    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getFunctionalitiesByScreen(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id; // may be null
    const { screen_id, page = 1, limit = 25 } = req.query;

    if (!screen_id) {
      return errorResponse(res, 400, "screen_id is required");
    }

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    // Fetch paginated data
    const dataQuery = `
      SELECT
        functionality_id,
        name,
        screen_id,
        company_id,
        builder_id,
        created_at,
        updated_at
      FROM functionality
      WHERE screen_id = $1 AND builder_id = $2
      ORDER BY name
      LIMIT $3 OFFSET $4;
    `;
    const dataResult = await client.query(dataQuery, [
      screen_id,
      builderId,
      limitValue,
      offset,
    ]);

    // Fetch total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM functionality
      WHERE screen_id = $1 AND builder_id = $2;
    `;
    const countResult = await client.query(countQuery, [screen_id, builderId]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        functionalities: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Functionalities fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching functionalities:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getFunctionalitiesByScreenWithoutPagination(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { screenId } = req.params;

    if (!screenId) {
      return errorResponse(res, 400, "screenId is required");
    }

    const screenCheckQuery = `
      SELECT screen_id
      FROM screen
      WHERE screen_id = $1;
    `;

    const screenCheck = await client.query(screenCheckQuery, [screenId]);

    if (screenCheck.rowCount === 0) {
      return errorResponse(res, 404, "Screen not found");
    }

    const dataQuery = `
      SELECT
        functionality_id,
        name
      FROM functionality
      WHERE screen_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await client.query(dataQuery, [screenId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Functionalities fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching functionalities:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
