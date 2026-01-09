const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionSubChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      construction_checklist_id,
      name,
      data_required,
      no_of_days
    } = req.body;

    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_checklist_id) {
      return errorResponse(res, 400, "construction_checklist_id is required");
    }

    if (!name) {
      return errorResponse(res, 400, "name is required");
    }

    const checklistCheck = await client.query(
      `SELECT construction_checklist_id FROM construction_checklist WHERE construction_checklist_id = $1 AND builder_id = $2 AND company_id = $3`,
      [construction_checklist_id, builderId, companyId]
    );
    if (checklistCheck.rowCount === 0) {
      return errorResponse(res, 400, "Invalid construction_checklist_id or access denied");
    }

    const insertResult = await client.query(
      `
      INSERT INTO construction_sub_checklist (
        construction_checklist_id,
        name,
        data_required,
        no_of_days
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
      `,
      [
        construction_checklist_id,
        name,
        data_required !== undefined ? data_required : true,
        no_of_days !== undefined ? no_of_days : 0
      ]
    );

    const constructionSubChecklistId = insertResult.rows[0].construction_sub_checklist_id;

    const responseQuery = `
      SELECT
        csc.construction_sub_checklist_id,
        csc.name,
        csc.data_required,
        csc.no_of_days,
        json_build_object(
          'id', cc.construction_checklist_id,
          'name', cc.name
        ) AS construction_checklist,
        csc.created_at,
        csc.updated_at

      FROM construction_sub_checklist csc
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id
      WHERE csc.construction_sub_checklist_id = $1 AND cc.builder_id = $2 AND cc.company_id = $3;
    `;

    const responseResult = await client.query(responseQuery, [constructionSubChecklistId, builderId, companyId]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction sub checklist created successfully."
    );
  } catch (error) {
    console.error("Create Construction Sub Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionSubChecklists = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { 
      page = 1, 
      limit = 25, 
      construction_checklist_id,
      data_required,
      no_of_days
    } = req.query;

    const { builder_id: builderId, company_id: companyId } = req.user;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offsetValue = (pageValue - 1) * limitValue;

    let whereClause = "WHERE 1=1";
    let values = [];
    let paramIndex = 1;

    // Add filters
    if (construction_checklist_id) {
      whereClause += ` AND csc.construction_checklist_id = $${paramIndex++}`;
      values.push(construction_checklist_id);
    }

    if (data_required !== undefined) {
      whereClause += ` AND csc.data_required = $${paramIndex++}`;
      values.push(data_required === 'true');
    }

    if (no_of_days !== undefined) {
      whereClause += ` AND csc.no_of_days = $${paramIndex++}`;
      values.push(parseInt(no_of_days, 10));
    }

    whereClause += ` AND cc.builder_id = $${paramIndex++} AND cc.company_id = $${paramIndex++}`;
    values.push(builderId, companyId);

    const dataQuery = `
      SELECT
        csc.construction_sub_checklist_id,
        csc.name,
        csc.data_required,
        csc.no_of_days,

        json_build_object(
          'id', cc.construction_checklist_id,
          'name', cc.name
        ) AS constructionChecklist,
        csc.created_at,
        csc.updated_at

      FROM construction_sub_checklist csc
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id
      ${whereClause}
      ORDER BY cc.sort_order ASC, csc.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataResult = await client.query(dataQuery, [...values, limitValue, offsetValue]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM construction_sub_checklist csc
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id
      ${whereClause};
    `;

    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        subChecklists: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Construction sub checklists fetched successfully."
    );
  } catch (error) {
    console.error("Get All Construction Sub Checklists Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getConstructionSubChecklistById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_sub_checklist_id } = req.params;
    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_sub_checklist_id) {
      return errorResponse(res, 400, "construction_sub_checklist_id is required.");
    }

    const query = `
      SELECT
        csc.construction_sub_checklist_id,
        csc.name,
        csc.data_required,
        csc.no_of_days,

        json_build_object(
          'id', cc.construction_checklist_id,
          'name', cc.name
        ) AS constructionChecklist,
        csc.created_at,
        csc.updated_at

      FROM construction_sub_checklist csc
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id
      WHERE csc.construction_sub_checklist_id = $1 AND cc.builder_id = $2 AND cc.company_id = $3;
    `;

    const result = await client.query(query, [construction_sub_checklist_id, builderId, companyId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Construction sub checklist not found or access denied.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction sub checklist fetched successfully."
    );
  } catch (error) {
    console.error("Get Construction Sub Checklist By ID Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateConstructionSubChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_sub_checklist_id } = req.params;
    const {
      name,
      data_required,
      no_of_days
    } = req.body;

    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_sub_checklist_id) {
      return errorResponse(res, 400, "construction_sub_checklist_id is required.");
    }

    const existingResult = await client.query(
      `SELECT csc.*, cc.builder_id, cc.company_id FROM construction_sub_checklist csc
       LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id 
       WHERE csc.construction_sub_checklist_id = $1`,
      [construction_sub_checklist_id]
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(res, 404, "Construction sub checklist not found.");
    }

    if (existingResult.rows[0].builder_id !== builderId || existingResult.rows[0].company_id !== companyId) {
      return errorResponse(res, 403, "Access denied - you can only update your own records.");
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (name !== undefined) {
      if (!name) {
        return errorResponse(res, 400, "Name cannot be empty");
      }
      updateFields.push(`name = $${idx++}`);
      updateValues.push(name);
    }

    if (data_required !== undefined) {
      updateFields.push(`data_required = $${idx++}`);
      updateValues.push(data_required);
    }

    if (no_of_days !== undefined) {
      updateFields.push(`no_of_days = $${idx++}`);
      updateValues.push(no_of_days);
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "At least one field is required for update.");
    }

    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `UPDATE construction_sub_checklist SET ${updateFields.join(', ')} 
       WHERE construction_sub_checklist_id = $${idx}`,
      [...updateValues, construction_sub_checklist_id]
    );

    const responseQuery = `
      SELECT
        csc.construction_sub_checklist_id,
        csc.name,
        csc.data_required,
        csc.no_of_days,

        json_build_object(
          'id', cc.construction_checklist_id,
          'name', cc.name
        ) AS constructionChecklist,
        csc.created_at,
        csc.updated_at

      FROM construction_sub_checklist csc
      LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id
      WHERE csc.construction_sub_checklist_id = $1 AND cc.builder_id = $2 AND cc.company_id = $3;
    `;

    const responseResult = await client.query(responseQuery, [construction_sub_checklist_id, builderId, companyId]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction sub checklist updated successfully."
    );
  } catch (error) {
    console.error("Update Construction Sub Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.deleteConstructionSubChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_sub_checklist_id } = req.params;
    const { builder_id: builderId, company_id: companyId } = req.user;

    if (!construction_sub_checklist_id) {
      return errorResponse(res, 400, "construction_sub_checklist_id is required.");
    }

    const checkResult = await client.query(
      `SELECT csc.*, cc.builder_id, cc.company_id FROM construction_sub_checklist csc
       LEFT JOIN construction_checklist cc ON cc.construction_checklist_id = csc.construction_checklist_id 
       WHERE csc.construction_sub_checklist_id = $1`,
      [construction_sub_checklist_id]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Construction sub checklist not found.");
    }

    if (checkResult.rows[0].builder_id !== builderId || checkResult.rows[0].company_id !== companyId) {
      return errorResponse(res, 403, "Access denied - you can only delete your own records.");
    }

    await client.query(
      `DELETE FROM construction_sub_checklist WHERE construction_sub_checklist_id = $1`,
      [construction_sub_checklist_id]
    );

    return successResponse(
      res,
      {},
      "Construction sub checklist deleted successfully."
    );
  } catch (error) {
    console.error("Delete Construction Sub Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};