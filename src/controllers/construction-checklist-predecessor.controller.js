const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionChecklistPredecessor = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      construction_checklist_id,
      predecessor_checklist_id,
      offset,
      duration,
    } = req.body;

    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_checklist_id) {
      return errorResponse(res, 400, "construction_checklist_id is required");
    }

    const checklistCheck = await client.query(
      `SELECT construction_checklist_id FROM construction_checklist WHERE construction_checklist_id = $1 AND builder_id = $2 AND company_id = $3`,
      [construction_checklist_id, builderId, companyId],
    );
    if (checklistCheck.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "Invalid construction_checklist_id or access denied",
      );
    }

    if (predecessor_checklist_id) {
      const predecessorCheck = await client.query(
        `SELECT construction_checklist_id FROM construction_checklist WHERE construction_checklist_id = $1 AND builder_id = $2 AND company_id = $3`,
        [predecessor_checklist_id, builderId, companyId],
      );
      if (predecessorCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid predecessor_checklist_id or access denied",
        );
      }
    }

    const existingCheck = await client.query(
      `SELECT construction_checklist_predecessor_id 
       FROM construction_checklist_predecessor 
       WHERE construction_checklist_id = $1 AND predecessor_checklist_id = $2`,
      [construction_checklist_id, predecessor_checklist_id || null],
    );
    if (existingCheck.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Predecessor relationship already exists for this checklist",
      );
    }

    const insertResult = await client.query(
      `INSERT INTO construction_checklist_predecessor (
        construction_checklist_id,
        predecessor_checklist_id,
        off_set,
        duration
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        construction_checklist_id,
        predecessor_checklist_id || null,
        offset !== undefined ? offset : false,
        duration !== undefined ? duration : 0,
      ],
    );

    const predecessorId =
      insertResult.rows[0].construction_checklist_predecessor_id;

    const responseQuery = `
      SELECT
        ccp.construction_checklist_predecessor_id,
        ccp.construction_checklist_id,
        ccp.predecessor_checklist_id,
        predecessor.name as predecessor_checklist_name,
        ccp.off_set As offset,
        ccp.duration,
        ccp.created_at,
        ccp.updated_at
      FROM construction_checklist_predecessor ccp
      LEFT JOIN construction_checklist cc1
        ON cc1.construction_checklist_id = ccp.construction_checklist_id
      LEFT JOIN construction_checklist predecessor
        ON predecessor.construction_checklist_id = ccp.predecessor_checklist_id
      WHERE ccp.construction_checklist_predecessor_id = $1;
    `;

    const responseResult = await client.query(responseQuery, [predecessorId]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction checklist predecessor created successfully.",
    );
  } catch (error) {
    console.error("Create Construction Checklist Predecessor Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionChecklistPredecessors = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      construction_checklist_id,
      predecessor_checklist_id,
      offset,
      duration,
    } = req.query;

    const { builder_id: builderId, company_id: companyId } = req.user;

    let whereClause = "WHERE 1=1";
    let values = [];
    let paramIndex = 1;

    if (construction_checklist_id) {
      whereClause += ` AND ccp.construction_checklist_id = $${paramIndex++}`;
      values.push(construction_checklist_id);
    }

    if (predecessor_checklist_id) {
      whereClause += ` AND ccp.predecessor_checklist_id = $${paramIndex++}`;
      values.push(predecessor_checklist_id);
    }

    if (offset !== undefined) {
      whereClause += ` AND ccp.off_set = $${paramIndex++}`;
      values.push(offset === "true");
    }

    if (duration !== undefined) {
      whereClause += ` AND ccp.duration = $${paramIndex++}`;
      values.push(parseInt(duration, 10));
    }

    whereClause += ` AND cc.builder_id = $${paramIndex++} AND cc.company_id = $${paramIndex++}`;
    values.push(builderId, companyId);

    const dataQuery = `
      SELECT
        ccp.construction_checklist_predecessor_id,
        ccp.construction_checklist_id,
        ccp.predecessor_checklist_id,
        predecessor.name as predecessor_checklist_name,
        ccp.off_set AS offset,
        ccp.duration,
        ccp.created_at,
        ccp.updated_at
      FROM construction_checklist_predecessor ccp
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = ccp.construction_checklist_id
      LEFT JOIN construction_checklist predecessor ON predecessor.construction_checklist_id = ccp.predecessor_checklist_id
      ${whereClause}
      ORDER BY cc.sort_order ASC, predecessor.sort_order ASC, ccp.created_at DESC;
    `;

    const dataResult = await client.query(dataQuery, values);

    return successResponse(
      res,
      keysToCamelCase(dataResult.rows),
      "Construction checklist predecessors fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Construction Checklist Predecessors Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getConstructionChecklistPredecessorById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_checklist_predecessor_id } = req.params;
    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_checklist_predecessor_id) {
      return errorResponse(
        res,
        400,
        "construction_checklist_predecessor_id is required.",
      );
    }

    const query = `
      SELECT
        ccp.construction_checklist_predecessor_id,
        ccp.construction_checklist_id as construction_checklist,
        ccp.predecessor_checklist_id,
        predecessor.name as predecessor_checklist_name,
        ccp.off_set AS offset,
        ccp.duration,
        ccp.created_at,
        ccp.updated_at
      FROM construction_checklist_predecessor ccp
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = ccp.construction_checklist_id
      LEFT JOIN construction_checklist predecessor ON predecessor.construction_checklist_id = ccp.predecessor_checklist_id
      WHERE ccp.construction_checklist_predecessor_id = $1 AND cc.builder_id = $2 AND cc.company_id = $3;
    `;

    const result = await client.query(query, [
      construction_checklist_predecessor_id,
      builderId,
      companyId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction checklist predecessor not found or access denied.",
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction checklist predecessor fetched successfully.",
    );
  } catch (error) {
    console.error("Get Construction Checklist Predecessor By ID Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateConstructionChecklistPredecessor = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_checklist_predecessor_id } = req.params;
    const { predecessor_checklist_id, offset, duration } = req.body;

    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_checklist_predecessor_id) {
      return errorResponse(
        res,
        400,
        "construction_checklist_predecessor_id is required.",
      );
    }

    const existingResult = await client.query(
      `SELECT ccp.*, cc.builder_id, cc.company_id FROM construction_checklist_predecessor ccp
       LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = ccp.construction_checklist_id 
       WHERE ccp.construction_checklist_predecessor_id = $1`,
      [construction_checklist_predecessor_id],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction checklist predecessor not found.",
      );
    }

    if (
      existingResult.rows[0].builder_id !== builderId ||
      existingResult.rows[0].company_id !== companyId
    ) {
      return errorResponse(
        res,
        403,
        "Access denied - you can only update your own records.",
      );
    }

    if (predecessor_checklist_id !== undefined) {
      if (predecessor_checklist_id) {
        const predecessorCheck = await client.query(
          `SELECT construction_checklist_id FROM construction_checklist WHERE construction_checklist_id = $1 AND builder_id = $2 AND company_id = $3`,
          [predecessor_checklist_id, builderId, companyId],
        );
        if (predecessorCheck.rowCount === 0) {
          return errorResponse(
            res,
            400,
            "Invalid predecessor_checklist_id or access denied",
          );
        }
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (predecessor_checklist_id !== undefined) {
      updateFields.push(`predecessor_checklist_id = $${idx++}`);
      updateValues.push(predecessor_checklist_id || null);
    }

    if (offset !== undefined) {
      updateFields.push(`off_set = $${idx++}`);
      updateValues.push(offset);
    }

    if (duration !== undefined) {
      updateFields.push(`duration = $${idx++}`);
      updateValues.push(duration);
    }

    if (updateFields.length === 0) {
      return errorResponse(
        res,
        400,
        "At least one field is required for update.",
      );
    }

    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `UPDATE construction_checklist_predecessor SET ${updateFields.join(", ")} 
       WHERE construction_checklist_predecessor_id = $${idx}`,
      [...updateValues, construction_checklist_predecessor_id],
    );

    const responseQuery = `
      SELECT
        ccp.construction_checklist_predecessor_id,
        ccp.construction_checklist_id,
        ccp.predecessor_checklist_id,
        predecessor.name as predecessor_checklist_name,
        ccp.off_set AS offset,
        ccp.duration,
        ccp.created_at,
        ccp.updated_at
      FROM construction_checklist_predecessor ccp
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = ccp.construction_checklist_id
      LEFT JOIN construction_checklist predecessor ON predecessor.construction_checklist_id = ccp.predecessor_checklist_id
      WHERE ccp.construction_checklist_predecessor_id = $1;
    `;

    const responseResult = await client.query(responseQuery, [
      construction_checklist_predecessor_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction checklist predecessor updated successfully.",
    );
  } catch (error) {
    console.error("Update Construction Checklist Predecessor Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.deleteConstructionChecklistPredecessor = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_checklist_predecessor_id } = req.params;
    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_checklist_predecessor_id) {
      return errorResponse(
        res,
        400,
        "construction_checklist_predecessor_id is required.",
      );
    }

    const checkResult = await client.query(
      `SELECT ccp.*, cc.builder_id, cc.company_id FROM construction_checklist_predecessor ccp
       LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = ccp.construction_checklist_id 
       WHERE ccp.construction_checklist_predecessor_id = $1`,
      [construction_checklist_predecessor_id],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction checklist predecessor not found.",
      );
    }

    if (
      checkResult.rows[0].builder_id !== builderId ||
      checkResult.rows[0].company_id !== companyId
    ) {
      return errorResponse(
        res,
        403,
        "Access denied - you can only delete your own records.",
      );
    }

    await client.query(
      `DELETE FROM construction_checklist_predecessor WHERE construction_checklist_predecessor_id = $1`,
      [construction_checklist_predecessor_id],
    );

    return successResponse(
      res,
      {},
      "Construction checklist predecessor deleted successfully.",
    );
  } catch (error) {
    console.error("Delete Construction Checklist Predecessor Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
