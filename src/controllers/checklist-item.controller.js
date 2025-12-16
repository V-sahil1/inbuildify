const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createChecklistItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.users_id;

    const {
      checklist_id,
      description,
      notes = false,
      is_required = false,
      type,
      sort,
    } = req.body;

    if (!checklist_id || !description || !type || sort === undefined) {
      return errorResponse(
        res,
        400,
        "checklist_id, description, type, and sort are required."
      );
    }

    if (!["checkbox", "dropdown"].includes(type)) {
      return errorResponse(
        res,
        400,
        "Invalid type. Allowed: checkbox, dropdown."
      );
    }

    await client.query("BEGIN");

    const checklistQuery = `
      SELECT checklist_id 
      FROM checklist 
      WHERE checklist_id = $1 AND builder_id = $2 AND is_deleted = FALSE AND is_active = true
    `;
    const checklist = await client.query(checklistQuery, [
      checklist_id,
      builderId,
    ]);

    if (checklist.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "Checklist is invalid or inactive.");
    }

    const duplicateCheckQuery = `
  SELECT ci.checklist_item_id
  FROM checklist_item ci
  INNER JOIN checklist c
    ON c.checklist_id = ci.checklist_id
  WHERE ci.checklist_id = $1
    AND ci.description = $2
    AND c.builder_id = $3
    AND c.is_deleted = FALSE
  LIMIT 1;
`;

    const duplicateResult = await client.query(duplicateCheckQuery, [
      checklist_id,
      description.trim(),
      builderId,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Description with this name already exists for this checklist."
      );
    }

    const sortCheckQuery = `
      SELECT 1 FROM checklist_item
      WHERE checklist_id = $1 AND sort = $2
    `;
    const sortExists = await client.query(sortCheckQuery, [checklist_id, sort]);

    if (sortExists.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        `Sort order ${sort} already exists in this checklist.`
      );
    }

    const insertQuery = `
      INSERT INTO checklist_item
      (checklist_id, description, notes, is_required, type, sort, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *;
    `;

    const values = [checklist_id, description, notes, is_required, type, sort];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Checklist item created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating checklist item:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.getAllChecklistItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    const { page = 1, limit = 25, sortOrder = "asc" } = req.query;

    const limitValue = parseInt(limit, 10);
    const offsetValue = (parseInt(page, 10) - 1) * limitValue;

    const sortDirection =
      String(sortOrder).toLowerCase() === "desc" ? "DESC" : "ASC";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM checklist_item ci
      JOIN checklist c ON c.checklist_id = ci.checklist_id
      WHERE c.builder_id = $1 AND c.is_deleted = FALSE
    `;

    const countResult = await client.query(countQuery, [builderId]);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT ci.*
      FROM checklist_item ci
      JOIN checklist c ON c.checklist_id = ci.checklist_id
      WHERE c.builder_id = $1 AND c.is_deleted = FALSE
      ORDER BY ci.sort ${sortDirection}
      LIMIT $2 OFFSET $3;
    `;

    const data = await client.query(dataQuery, [
      builderId,
      limitValue,
      offsetValue,
    ]);

    return successResponse(
      res,
      {
        records: keysToCamelCase(data.rows),
        total,
        page: parseInt(page, 10),
        limit: limitValue,
        sortOrder: sortDirection,
        totalPages: Math.ceil(total / limitValue),
      },
      "Checklist items fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching checklist items:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.getChecklistItemsByChecklistId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { checklist_id } = req.params;

    if (!checklist_id) {
      return errorResponse(res, 400, "checklist_id is required.");
    }

    const checklistCheck = `
      SELECT checklist_id 
      FROM checklist
      WHERE checklist_id = $1 AND builder_id = $2 AND is_deleted = FALSE
    `;
    const checklist = await client.query(checklistCheck, [
      checklist_id,
      builderId,
    ]);

    if (checklist.rowCount === 0) {
      return errorResponse(
        res,
        403,
        "Checklist does not belong to this builder."
      );
    }

    const itemsQuery = `
      SELECT *
      FROM checklist_item
      WHERE checklist_id = $1
      ORDER BY sort ASC;
    `;

    const items = await client.query(itemsQuery, [checklist_id]);

    return successResponse(
      res,
      keysToCamelCase(items.rows),
      "Checklist items fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching checklist items by checklist ID:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};

exports.deleteChecklistItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { checklist_item_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID missing");
    }

    const checkQuery = `
      SELECT ci.checklist_item_id
      FROM checklist_item ci
      JOIN checklist c ON c.checklist_id = ci.checklist_id
      WHERE ci.checklist_item_id = $1
      AND c.builder_id = $2
    `;

    const checkResult = await client.query(checkQuery, [
      checklist_item_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Checklist item not found or you are not allowed to delete this item"
      );
    }

    const deleteQuery = `
      DELETE FROM checklist_item
      WHERE checklist_item_id = $1
    `;
    await client.query(deleteQuery, [checklist_item_id]);

    return successResponse(
      res,
      keysToCamelCase({ message: "Checklist item deleted successfully" })
    );
  } catch (err) {
    console.error("Error deleting checklist item:", err);
    return errorResponse(res, 500, err.message);
  } finally {
    client.release();
  }
};

exports.updateChecklistItem = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { checklist_item_id } = req.params;

    const builderId = req.user?.builder_id;
    const userId = req.user?.users_id;

    const { checklist_id, description, notes, is_required, type, sort } =
      req.body;

    await client.query("BEGIN");

    const findItemQuery = `
      SELECT ci.*, c.builder_id
      FROM checklist_item ci
      JOIN checklist c ON c.checklist_id = ci.checklist_id
      WHERE ci.checklist_item_id = $1 AND c.is_deleted = FALSE
    `;
    const itemResult = await client.query(findItemQuery, [checklist_item_id]);

    if (itemResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Checklist item not found.");
    }

    const item = itemResult.rows[0];

    if (item.builder_id !== builderId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not allowed to update this checklist item."
      );
    }

    let finalChecklistId = item.checklist_id;

    if (checklist_id) {
      const checklistQuery = `
        SELECT checklist_id 
        FROM checklist 
        WHERE checklist_id = $1 AND builder_id = $2 AND is_deleted = FALSE
      `;
      const checklist = await client.query(checklistQuery, [
        checklist_id,
        builderId,
      ]);

      if (checklist.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Checklist does not belong to this builder."
        );
      }

      finalChecklistId = checklist_id;
    }

    const finalDescription =
      description !== undefined ? description.trim() : item.description;

    const duplicateCheckQuery = `
  SELECT ci.checklist_item_id
  FROM checklist_item ci
  JOIN checklist c ON c.checklist_id = ci.checklist_id
  WHERE ci.checklist_id = $1
    AND ci.description = $2
    AND c.builder_id = $3
    AND c.is_deleted = FALSE
    AND ci.checklist_item_id <> $4
  LIMIT 1;
`;

    const duplicateResult = await client.query(duplicateCheckQuery, [
      finalChecklistId,
      finalDescription,
      builderId,
      checklist_item_id,
    ]);

    if (duplicateResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Description with this name already exists for this checklist."
      );
    }

    if (type && !["checkbox", "dropdown"].includes(type)) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid type. Allowed: checkbox, dropdown."
      );
    }

    if (sort !== undefined) {
      const sortCheckQuery = `
        SELECT 1 
        FROM checklist_item
        WHERE checklist_id = $1 
        AND sort = $2
        AND checklist_item_id != $3
      `;
      const sortExists = await client.query(sortCheckQuery, [
        finalChecklistId,
        sort,
        checklist_item_id,
      ]);

      if (sortExists.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          `Sort order ${sort} already exists in this checklist.`
        );
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (checklist_id) {
      fields.push(`checklist_id = $${index++}`);
      values.push(checklist_id);
    }
    if (description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(description);
    }
    if (notes !== undefined) {
      fields.push(`notes = $${index++}`);
      values.push(notes);
    }
    if (is_required !== undefined) {
      fields.push(`is_required = $${index++}`);
      values.push(is_required);
    }
    if (type !== undefined) {
      fields.push(`type = $${index++}`);
      values.push(type);
    }
    if (sort !== undefined) {
      fields.push(`sort = $${index++}`);
      values.push(sort);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update.");
    }

    const updateQuery = `
      UPDATE checklist_item
      SET ${fields.join(", ")}
      WHERE checklist_item_id = $${index}
      RETURNING *;
    `;

    values.push(checklist_item_id);

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Checklist item updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating checklist item:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};
