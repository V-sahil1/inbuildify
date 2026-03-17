import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createSalesStage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    const {
      sales_process_id,
      stage_name,
      functionality_id,
      category,
      sort_order,
      is_active,
    } = req.body;

    await client.query("BEGIN");

    const checkProcess = await client.query(
      "SELECT 1 FROM sales_process WHERE sales_process_id = $1 AND builder_id = $2 LIMIT 1",
      [sales_process_id, builderId],
    );

    if (checkProcess.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid sales process for this builder.");
    }

    const existing = await client.query(
      "SELECT 1 FROM sales_stage WHERE sales_process_id = $1 AND stage_name = $2 LIMIT 1",
      [sales_process_id, stage_name.trim()],
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Stage name already exists for this sales process.",
      );
    }

    if (Array.isArray(functionality_id) && functionality_id.length > 0) {
      const funcCheck = await client.query(
        `
      SELECT functionality_id
      FROM sales_process_stage_functionality
      WHERE functionality_id = ANY($1)
    `,
        [functionality_id],
      );

      if (funcCheck.rowCount !== functionality_id.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more functionality_id values are invalid.",
        );
      }
    }

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    const maxSortOrderQuery = `
  SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
  FROM sales_stage
  WHERE sales_process_id = $1;
`;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      sales_process_id,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    const shiftSortOrderQuery = `
  UPDATE sales_stage
  SET sort_order = sort_order + 1
  WHERE sort_order >= $1
    AND sales_process_id = $2;
`;

    await client.query(shiftSortOrderQuery, [finalSortOrder, sales_process_id]);

    const insertQuery = `
      WITH inserted AS (
        INSERT INTO sales_stage (
          sales_process_id,
          stage_name,
          functionality_id,
          category,
          sort_order,
          is_active,
          created_by,
          updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING sales_stage_id, sales_process_id, stage_name, functionality_id, category, sort_order, is_active, created_by, updated_by, created_at, updated_at
      )
      SELECT
        i.sales_stage_id,
        i.sales_process_id,
        i.stage_name,
        i.category,
        i.sort_order,
        i.is_active,
        i.created_by,
        i.updated_by,
        i.created_at,
        i.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.functionality_id,
              'name', f.name
            )
          ) FILTER (WHERE f.functionality_id IS NOT NULL),
          '[]'
        ) AS functionality
      FROM inserted i
      LEFT JOIN sales_process_stage_functionality f
        ON f.functionality_id = ANY(i.functionality_id)
      GROUP BY i.sales_stage_id, i.sales_process_id, i.stage_name, i.category, i.sort_order, i.is_active, i.created_by, i.updated_by, i.created_at, i.updated_at;
    `;

    const values = [
      sales_process_id,
      stage_name.trim(),
      functionality_id || [],
      category,
      sort_order || 1,
      is_active ?? true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales stage created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating sales stage:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllSalesStages(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;

    if (!builderId) {
      return errorResponse(res, 403, "Unauthorized. Builder ID missing.");
    }

    const dataQuery = `
      SELECT 
        ss.sales_stage_id,
        ss.sales_process_id,
        ss.stage_name,
        ss.functionality_id,
        ss.category,
        ss.sort_order,
        ss.is_active,
        ss.created_at,
        ss.updated_at,
        ss.created_by, 
        ss.updated_by
      FROM sales_stage ss
      INNER JOIN sales_process sp 
        ON ss.sales_process_id = sp.sales_process_id
      WHERE sp.builder_id = $1
      ORDER BY ss.sort_order ASC;
    `;
    const result = await pool.query(dataQuery, [builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Sales stages fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching sales stages:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteSalesStage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { sales_stage_id } = req.params;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    if (!sales_stage_id) {
      return errorResponse(res, 400, "sales_stage_id is required.");
    }

    await client.query("BEGIN");

    const ownershipCheck = await client.query(
      `SELECT ss.sales_stage_id
       FROM sales_stage ss
       JOIN sales_process sp ON ss.sales_process_id = sp.sales_process_id
       WHERE ss.sales_stage_id = $1
         AND sp.builder_id = $2
       LIMIT 1;`,
      [sales_stage_id, builderId],
    );

    if (ownershipCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Sales stage not found or you don't have permission to delete it.",
      );
    }

    const deleteQuery = `
      DELETE FROM sales_stage
      WHERE sales_stage_id = $1
      RETURNING *;
    `;

    const result = await client.query(deleteQuery, [sales_stage_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Sales stage permanently deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting sales stage:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateSalesStage(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { sales_stage_id } = req.params;
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    const { stage_name, functionality_id, category, sort_order, is_active } = req.body;

    const updatingOtherFields =
      stage_name || functionality_id || category || sort_order !== undefined;

    if (!updatingOtherFields && is_active === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    await client.query("BEGIN");

    const stageCheck = await client.query(
      `SELECT 
          ss.sales_process_id,
          ss.is_active
        FROM sales_stage ss
        JOIN sales_process sp 
          ON ss.sales_process_id = sp.sales_process_id 
        WHERE ss.sales_stage_id = $1 
          AND sp.builder_id = $2`,
      [sales_stage_id, builderId],
    );

    if (stageCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Sales stage not found for this builder.");
    }

    const stageActiveCheck = await client.query(
      `SELECT
          ss.sales_process_id,
          ss.is_active
        FROM sales_stage ss
        JOIN sales_process sp
          ON ss.sales_process_id = sp.sales_process_id
        WHERE ss.sales_stage_id = $1
          AND sp.builder_id = $2 AND is_active = true`,
      [sales_stage_id, builderId],
    );

    if (stageActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive sales stage.");
    }

    const salesProcessId = stageCheck.rows[0].sales_process_id;

    if (stage_name) {
      const dup = await client.query(
        `SELECT 1 FROM sales_stage 
          WHERE sales_process_id = $1
            AND LOWER(stage_name) = LOWER($2)
            AND sales_stage_id != $3`,
        [salesProcessId, stage_name.trim(), sales_stage_id],
      );

      if (dup.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Stage name already exists.");
      }
    }

    if (functionality_id !== undefined) {
      if (!Array.isArray(functionality_id)) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "functionality_id must be an array of UUIDs.",
        );
      }

      if (functionality_id.length > 0) {
        const funcCheck = await client.query(
          `
          SELECT functionality_id
          FROM sales_process_stage_functionality
          WHERE functionality_id = ANY($1)
          `,
          [functionality_id],
        );

        if (funcCheck.rowCount !== functionality_id.length) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "One or more functionality_id values are invalid.",
          );
        }
      }
    }

    const existingSortQuery = `
  SELECT sort_order
  FROM sales_stage
  WHERE sales_stage_id = $1
  FOR UPDATE;
`;
    const existingResult = await client.query(existingSortQuery, [
      sales_stage_id,
    ]);
    const existingSortOrder = existingResult.rows[0].sort_order;

    if (sort_order !== undefined && sort_order !== null) {
      const maxSortQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM sales_stage
    WHERE sales_process_id = $1
  `;
      const maxSortResult = await client.query(maxSortQuery, [salesProcessId]);
      const maxSortOrder = maxSortResult.rows[0].max_sort_order;

      if (sort_order < 1 || sort_order > maxSortOrder) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          await client.query(
            `
        UPDATE sales_stage
        SET sort_order = sort_order - 1
        WHERE sort_order > $1
          AND sort_order <= $2
          AND sales_stage_id != $3
          AND sales_process_id = $4
        `,
            [existingSortOrder, sort_order, sales_stage_id, salesProcessId],
          );
        } else {
          await client.query(
            `
        UPDATE sales_stage
        SET sort_order = sort_order + 1
        WHERE sort_order >= $1
          AND sort_order < $2
          AND sales_stage_id != $3
          AND sales_process_id = $4
        `,
            [sort_order, existingSortOrder, sales_stage_id, salesProcessId],
          );
        }
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (stage_name) {
      fields.push(`stage_name = $${i++}`);
      values.push(stage_name.trim());
    }
    if (functionality_id) {
      fields.push(`functionality_id = $${i++}`);
      values.push(functionality_id);
    }
    if (category) {
      fields.push(`category = $${i++}`);
      values.push(category);
    }
    if (sort_order !== undefined) {
      fields.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }

    fields.push(`updated_by = $${i++}`);
    values.push(userId);

    fields.push("updated_at = NOW()");

    const query = `
      WITH updated AS (
        UPDATE sales_stage
        SET ${fields.join(", ")}
        WHERE sales_stage_id = $${i}
        RETURNING sales_stage_id, sales_process_id, stage_name, functionality_id, category, sort_order, is_active, created_by, updated_by, created_at, updated_at
      )
      SELECT
        u.sales_stage_id,
        u.sales_process_id,
        u.stage_name,
        u.category,
        u.sort_order,
        u.is_active,
        u.created_by,
        u.updated_by,
        u.created_at,
        u.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.functionality_id,
              'name', f.name
            )
          ) FILTER (WHERE f.functionality_id IS NOT NULL),
          '[]'
        ) AS functionality
      FROM updated u
      LEFT JOIN sales_process_stage_functionality f
        ON f.functionality_id = ANY(u.functionality_id)
      GROUP BY u.sales_stage_id, u.sales_process_id, u.stage_name, u.category, u.sort_order, u.is_active, u.created_by, u.updated_by, u.created_at, u.updated_at;
    `;

    values.push(sales_stage_id);

    const result = await client.query(query, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales stage updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return errorResponse(res, 500, err.message);
  } finally {
    client.release();
  }
}

export async function updateSalesStageIsActive(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { sales_stage_id } = req.params;
    const { is_active } = req.body;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    if (!sales_stage_id) {
      return errorResponse(res, 400, "Sales stage id is required.");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false).",
      );
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT ss.sales_stage_id
      FROM sales_stage ss
      JOIN sales_process sp
        ON ss.sales_process_id = sp.sales_process_id
      WHERE ss.sales_stage_id = $1
        AND sp.builder_id = $2
      `,
      [sales_stage_id, builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Sales stage not found for this builder.");
    }

    const updateQuery = `
      UPDATE sales_stage
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE sales_stage_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      is_active,
      userId,
      sales_stage_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Sales stage status updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating sales stage is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getSalesStagesBySalesProcessId(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const { sales_process_id } = req.query;

    if (!sales_process_id) {
      return errorResponse(res, 400, "Sales process ID is required.");
    }

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    await client.query("BEGIN");

    const processCheck = await client.query(
      `
      SELECT 1
      FROM sales_process
      WHERE sales_process_id = $1
        AND (builder_id = $2 OR company_id = $3)
      `,
      [sales_process_id, builderId, companyId],
    );

    if (processCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Sales process not found for this user.");
    }

    const stagesResult = await client.query(
      `
  SELECT
    ss.sales_stage_id,
    ss.sales_process_id,
    ss.stage_name,
    ss.category,
    ss.sort_order,
    ss.is_active,
    ss.created_at,
    ss.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', f.functionality_id,
          'name', f.name
        )
      ) FILTER (WHERE f.functionality_id IS NOT NULL),
      '[]'
    ) AS functionality
  FROM sales_stage ss
  LEFT JOIN sales_process_stage_functionality f
    ON f.functionality_id = ANY(ss.functionality_id)
  WHERE ss.sales_process_id = $1
  GROUP BY ss.sales_stage_id
  ORDER BY ss.sort_order ASC
  `,
      [sales_process_id],
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(stagesResult.rows),
      "Sales stages fetched successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error fetching sales stages:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
