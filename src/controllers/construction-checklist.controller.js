const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createConstructionChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      name,
      construction_type_id,
      construction_stage_id,
      supplier_type_id,
      sort_order,
      data_required,
      supplier,
      claim,
      dependent,
      no_of_days,
      notify,
      milestone,
      attachment_mandatory,
      attachment_mandatory_name,
      cost_center_id,
      construction_option_id,
      compliance_type_id,
      builder
    } = req.body;
    
    const { user_id, company_id, builder_id } = req.user;

    if (!name) {
      return errorResponse(res, 400, "Name is required");
    }

    if (construction_type_id) {
      const constructionTypeCheck = await client.query(
        `SELECT construction_type_id FROM construction_type WHERE construction_type_id = $1 AND builder_id = $2`,
        [construction_type_id, builder_id]
      );
      if (constructionTypeCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid construction_type_id");
      }
    }

    if (construction_stage_id) {
      const constructionStageCheck = await client.query(
        `SELECT construction_stage FROM construction_stage WHERE construction_stage = $1 AND builder_id = $2`,
        [construction_stage_id, builder_id]
      );
      if (constructionStageCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid construction_stage_id");
      }
    }

    if (supplier_type_id) {
      const supplierTypeCheck = await client.query(
        `SELECT supplier_type_id FROM supplier_type WHERE supplier_type_id = $1`,
        [supplier_type_id]
      );
      if (supplierTypeCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid supplier_type_id");
      }
    }

    if (cost_center_id) {
      const costCenterCheck = await client.query(
        `SELECT cost_center_id FROM cost_center WHERE cost_center_id = $1`,
        [cost_center_id]
      );
      if (costCenterCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid cost_center_id");
      }
    }

    if (construction_option_id) {
      const constructionOptionCheck = await client.query(
        `SELECT construction_option_id FROM construction_option WHERE construction_option_id = $1`,
        [construction_option_id]
      );
      if (constructionOptionCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid construction_option_id");
      }
    }

    if (compliance_type_id) {
      const complianceTypeCheck = await client.query(
        `SELECT compliance_type_id FROM compliance_type WHERE compliance_type_id = $1`,
        [compliance_type_id]
      );
      if (complianceTypeCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid compliance_type_id");
      }
    }

    if (builder) {
      const builderCheck = await client.query(
        `SELECT builder_id FROM builder WHERE builder_id = $1`,
        [builder]
      );
      if (builderCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid builder");
      }
    }

    const newSortOrder = sort_order || 1;
    await client.query(
      `UPDATE construction_checklist 
       SET sort_order = sort_order + 1 
       WHERE company_id = $1 AND builder_id = $2 AND sort_order >= $3`,
      [company_id, builder_id, newSortOrder]
    );

    const insertResult = await client.query(
      `
      INSERT INTO construction_checklist (
        company_id,
        builder_id,
        builder,
        construction_type_id,
        construction_stage_id,
        name,
        supplier_type_id,
        sort_order,
        data_required,
        supplier,
        claim,
        dependent,
        no_of_days,
        notify,
        milestone,
        attachment_mandatory,
        attachment_mandatory_name,
        cost_center_id,
        construction_option_id,
        compliance_type_id,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *;
      `,
      [
        company_id,
        builder_id,
        builder || null,
        construction_type_id || null,
        construction_stage_id || null,
        name,
        supplier_type_id || null,
        newSortOrder,
        data_required !== undefined ? data_required : true,
        supplier !== undefined ? supplier : true,
        claim !== undefined ? claim : false,
        dependent !== undefined ? dependent : false,
        no_of_days || 1,
        notify !== undefined ? notify : false,
        milestone !== undefined ? milestone : false,
        attachment_mandatory !== undefined ? attachment_mandatory : false,
        attachment_mandatory_name || null,
        cost_center_id || null,
        construction_option_id || null,
        compliance_type_id || null,
        user_id,
        user_id
      ]
    );

    const responseQuery = `
      SELECT
        cc.construction_checklist_id,
        cc.company_id,
        cc.builder_id,
        cc.builder,
        cc.name,
        cc.sort_order,
        cc.data_required,
        cc.supplier,
        cc.claim,
        cc.dependent,
        cc.no_of_days,
        cc.notify,
        cc.milestone,
        cc.attachment_mandatory,
        cc.attachment_mandatory_name,
        
        json_build_object(
          'id', ct.construction_type_id,
          'name', ct.types_name
        ) AS construction_type,
        json_build_object(
          'id', cs.construction_stage,
          'name', cs.stage_name
        ) AS construction_stage,
        json_build_object(
          'id', st.supplier_type_id,
          'name', st.name
        ) AS supplier_type,
        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,
        json_build_object(
          'id', cc_name.cost_center_id,
          'name', cc_name.name
        ) AS cost_center,
        json_build_object(
          'id', co.construction_option_id,
          'name', co.option_name
        ) AS construction_option,
        json_build_object(
          'id', cpt.compliance_type_id,
          'name', cpt.name
        ) AS compliance_type,
        u.name AS created_by_name,
        cc.created_by,
        cc.updated_by,
        cc.created_at,
        cc.updated_at
      FROM construction_checklist cc
      LEFT JOIN construction_type ct ON ct.construction_type_id = cc.construction_type_id
      LEFT JOIN construction_stage cs ON cs.construction_stage = cc.construction_stage_id
      LEFT JOIN supplier_type st ON st.supplier_type_id = cc.supplier_type_id
      LEFT JOIN builder b ON b.builder_id = cc.builder
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = cc.cost_center_id
      LEFT JOIN construction_option co ON co.construction_option_id = cc.construction_option_id
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      WHERE cc.construction_checklist_id = $1;`;

    const responseResult = await client.query(responseQuery, [insertResult.rows[0].construction_checklist_id]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction checklist created successfully."
    );
  } catch (error) {
    console.error("Create Construction Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getAllConstructionChecklists = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { 
      page = 1, 
      limit = 25, 
      construction_type_id, 
      construction_stage_id,
      supplier_type_id,
      builder,
      data_required,
      supplier,
      claim,
      dependent,
      notify,
      milestone,
      attachment_mandatory,
      cost_center_id,
      construction_option_id,
      compliance_type_id
    } = req.query;

    const { company_id, builder_id } = req.user;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let whereClause = "WHERE (cc.company_id = $1 OR cc.builder_id = $2)";
    let values = [company_id, builder_id];
    let paramIndex = values.length + 1;

    if (construction_type_id) {
      whereClause += ` AND cc.construction_type_id = $${paramIndex++}`;
      values.push(construction_type_id);
    }

    if (construction_stage_id) {
      whereClause += ` AND cc.construction_stage_id = $${paramIndex++}`;
      values.push(construction_stage_id);
    }

    if (supplier_type_id) {
      whereClause += ` AND cc.supplier_type_id = $${paramIndex++}`;
      values.push(supplier_type_id);
    }

    if (builder) {
      whereClause += ` AND cc.builder = $${paramIndex++}`;
      values.push(builder);
    }

    if (data_required !== undefined) {
      whereClause += ` AND cc.data_required = $${paramIndex++}`;
      values.push(data_required === 'true');
    }

    if (supplier !== undefined) {
      whereClause += ` AND cc.supplier = $${paramIndex++}`;
      values.push(supplier === 'true');
    }

    if (claim !== undefined) {
      whereClause += ` AND cc.claim = $${paramIndex++}`;
      values.push(claim === 'true');
    }

    if (dependent !== undefined) {
      whereClause += ` AND cc.dependent = $${paramIndex++}`;
      values.push(dependent === 'true');
    }

    if (notify !== undefined) {
      whereClause += ` AND cc.notify = $${paramIndex++}`;
      values.push(notify === 'true');
    }

    if (milestone !== undefined) {
      whereClause += ` AND cc.milestone = $${paramIndex++}`;
      values.push(milestone === 'true');
    }

    if (attachment_mandatory !== undefined) {
      whereClause += ` AND cc.attachment_mandatory = $${paramIndex++}`;
      values.push(attachment_mandatory === 'true');
    }

    if (cost_center_id) {
      whereClause += ` AND cc.cost_center_id = $${paramIndex++}`;
      values.push(cost_center_id);
    }

    if (construction_option_id) {
      whereClause += ` AND cc.construction_option_id = $${paramIndex++}`;
      values.push(construction_option_id);
    }

    if (compliance_type_id) {
      whereClause += ` AND cc.compliance_type_id = $${paramIndex++}`;
      values.push(compliance_type_id);
    }

    const dataQuery = `
      SELECT
        cc.construction_checklist_id,
        cc.company_id,
        cc.builder_id,
        cc.builder,
        cc.name,
        cc.supplier_type_id,
        cc.sort_order,
        cc.data_required,
        cc.supplier,
        cc.claim,
        cc.dependent,
        cc.no_of_days,
        cc.notify,
        cc.milestone,
        cc.attachment_mandatory,
        cc.attachment_mandatory_name,
        cc.cost_center_id,
        cc.construction_option_id,
        cc.compliance_type_id,
        
        json_build_object(
          'id', ct.construction_type_id,
          'name', ct.types_name
        ) AS construction_type,
        json_build_object(
          'id', cs.construction_stage,
          'name', cs.stage_name
        ) AS construction_stage,
        json_build_object(
          'id', st.supplier_type_id,
          'name', st.name
        ) AS supplier_type,
        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,
        json_build_object(
          'id', cc_name.cost_center_id,
          'name', cc_name.name
        ) AS cost_center,
        json_build_object(
          'id', co.construction_option_id,
          'name', co.option_name
        ) AS construction_option,
        json_build_object(
          'id', cpt.compliance_type_id,
          'name', cpt.name
        ) AS compliance_type,
        u.name AS created_by_name,
        cc.created_by,
        cc.updated_by,
        cc.created_at,
        cc.updated_at
      FROM construction_checklist cc
      LEFT JOIN construction_type ct ON ct.construction_type_id = cc.construction_type_id
      LEFT JOIN construction_stage cs ON cs.construction_stage = cc.construction_stage_id
      LEFT JOIN supplier_type st ON st.supplier_type_id = cc.supplier_type_id
      LEFT JOIN builder b ON b.builder_id = cc.builder
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = cc.cost_center_id
      LEFT JOIN construction_option co ON co.construction_option_id = cc.construction_option_id
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      ${whereClause}
      ORDER BY cc.sort_order ASC, cc.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataResult = await client.query(dataQuery, [...values, limitValue, offset]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM construction_checklist cc
      ${whereClause};
    `;

    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        checklists: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Construction checklists fetched successfully."
    );
  } catch (error) {
    console.error("Get All Construction Checklists Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.getConstructionChecklistById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_checklist_id } = req.params;

    if (!construction_checklist_id) {
      return errorResponse(res, 400, "construction_checklist_id is required.");
    }

    const query = `
      SELECT
        cc.*,
        ct.types_name AS construction_type_name,
        cs.stage_name AS construction_stage_name,
        st.name AS supplier_type_name,
        b.builder_name AS builder_name,
        cc_name.name AS cost_center_name,
        co.option_name AS construction_option_name,
        cpt.name AS compliance_type_name,
        u.name AS created_by_name
      FROM construction_checklist cc
      LEFT JOIN construction_type ct ON ct.construction_type_id = cc.construction_type_id
      LEFT JOIN construction_stage cs ON cs.construction_stage = cc.construction_stage_id
      LEFT JOIN supplier_type st ON st.supplier_type_id = cc.supplier_type_id
      LEFT JOIN builder b ON b.builder_id = cc.builder
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = cc.cost_center_id
      LEFT JOIN construction_option co ON co.construction_option_id = cc.construction_option_id
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      WHERE cc.construction_checklist_id = $1;
    `;

    const result = await client.query(query, [construction_checklist_id]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Construction checklist not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Construction checklist fetched successfully."
    );
  } catch (error) {
    console.error("Get Construction Checklist By ID Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.updateConstructionChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_checklist_id } = req.params;
    const {
      name,
      construction_type_id,
      construction_stage_id,
      supplier_type_id,
      sort_order,
      data_required,
      supplier,
      claim,
      dependent,
      no_of_days,
      notify,
      milestone,
      attachment_mandatory,
      attachment_mandatory_name,
      cost_center_id,
      construction_option_id,
      compliance_type_id,
      builder
    } = req.body;
    
    const { user_id, company_id, builder_id } = req.user;

    if (!construction_checklist_id) {
      return errorResponse(res, 400, "construction_checklist_id is required.");
    }

    const existingResult = await client.query(
      `SELECT construction_checklist_id FROM construction_checklist 
       WHERE construction_checklist_id = $1 
         AND (company_id = $2 OR builder_id = $3)`,
      [construction_checklist_id, company_id, builder_id]
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(res, 404, "Construction checklist not found.");
    }

    if (construction_type_id) {
      const constructionTypeCheck = await client.query(
        `SELECT construction_type_id FROM construction_type WHERE construction_type_id = $1`,
        [construction_type_id]
      );
      if (constructionTypeCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid construction_type_id");
      }
    }

    if (construction_stage_id) {
      const constructionStageCheck = await client.query(
        `SELECT construction_stage FROM construction_stage WHERE construction_stage = $1`,
        [construction_stage_id]
      );
      if (constructionStageCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid construction_stage_id");
      }
    }

    if (supplier_type_id) {
      const supplierTypeCheck = await client.query(
        `SELECT supplier_type_id FROM supplier_type WHERE supplier_type_id = $1`,
        [supplier_type_id]
      );
      if (supplierTypeCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid supplier_type_id");
      }
    }

    if (cost_center_id) {
      const costCenterCheck = await client.query(
        `SELECT cost_center_id FROM cost_center WHERE cost_center_id = $1`,
        [cost_center_id]
      );
      if (costCenterCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid cost_center_id");
      }
    }

    if (construction_option_id) {
      const constructionOptionCheck = await client.query(
        `SELECT construction_option_id FROM construction_option WHERE construction_option_id = $1`,
        [construction_option_id]
      );
      if (constructionOptionCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid construction_option_id");
      }
    }

    if (compliance_type_id) {
      const complianceTypeCheck = await client.query(
        `SELECT compliance_type_id FROM compliance_type WHERE compliance_type_id = $1`,
        [compliance_type_id]
      );
      if (complianceTypeCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid compliance_type_id");
      }
    }

    if (builder) {
      const builderCheck = await client.query(
        `SELECT builder_id FROM builder WHERE builder_id = $1`,
        [builder]
      );
      if (builderCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid builder");
      }
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

    if (construction_type_id !== undefined) {
      updateFields.push(`construction_type_id = $${idx++}`);
      updateValues.push(construction_type_id || null);
    }

    if (construction_stage_id !== undefined) {
      updateFields.push(`construction_stage_id = $${idx++}`);
      updateValues.push(construction_stage_id || null);
    }

    if (supplier_type_id !== undefined) {
      updateFields.push(`supplier_type_id = $${idx++}`);
      updateValues.push(supplier_type_id || null);
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${idx++}`);
      updateValues.push(sort_order || 1);
    }

    if (data_required !== undefined) {
      updateFields.push(`data_required = $${idx++}`);
      updateValues.push(data_required);
    }

    if (supplier !== undefined) {
      updateFields.push(`supplier = $${idx++}`);
      updateValues.push(supplier);
    }

    if (claim !== undefined) {
      updateFields.push(`claim = $${idx++}`);
      updateValues.push(claim);
    }

    if (dependent !== undefined) {
      updateFields.push(`dependent = $${idx++}`);
      updateValues.push(dependent);
    }

    if (no_of_days !== undefined) {
      updateFields.push(`no_of_days = $${idx++}`);
      updateValues.push(no_of_days || 1);
    }

    if (notify !== undefined) {
      updateFields.push(`notify = $${idx++}`);
      updateValues.push(notify);
    }

    if (milestone !== undefined) {
      updateFields.push(`milestone = $${idx++}`);
      updateValues.push(milestone);
    }

    if (attachment_mandatory !== undefined) {
      updateFields.push(`attachment_mandatory = $${idx++}`);
      updateValues.push(attachment_mandatory);
    }

    if (attachment_mandatory_name !== undefined) {
      updateFields.push(`attachment_mandatory_name = $${idx++}`);
      updateValues.push(attachment_mandatory_name || null);
    }

    if (cost_center_id !== undefined) {
      updateFields.push(`cost_center_id = $${idx++}`);
      updateValues.push(cost_center_id || null);
    }

    if (construction_option_id !== undefined) {
      updateFields.push(`construction_option_id = $${idx++}`);
      updateValues.push(construction_option_id || null);
    }

    if (compliance_type_id !== undefined) {
      updateFields.push(`compliance_type_id = $${idx++}`);
      updateValues.push(compliance_type_id || null);
    }

    if (builder !== undefined) {
      updateFields.push(`builder = $${idx++}`);
      updateValues.push(builder || null);
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "At least one field is required for update.");
    }

    let currentSortOrder = null;
    if (sort_order !== undefined) {
      const currentRecord = await client.query(
        `SELECT sort_order FROM construction_checklist 
         WHERE construction_checklist_id = $1`,
        [construction_checklist_id]
      );
      currentSortOrder = currentRecord.rows[0].sort_order;
      
      if (sort_order > currentSortOrder) {
        await client.query(
          `UPDATE construction_checklist 
           SET sort_order = sort_order - 1 
           WHERE company_id = $1 AND builder_id = $2 
             AND sort_order > $3 AND sort_order <= $4`,
          [company_id, builder_id, currentSortOrder, sort_order]
        );
      } else if (sort_order < currentSortOrder) {
        await client.query(
          `UPDATE construction_checklist 
           SET sort_order = sort_order + 1 
           WHERE company_id = $1 AND builder_id = $2 
             AND sort_order >= $3 AND sort_order < $4`,
          [company_id, builder_id, sort_order, currentSortOrder]
        );
      }
    }

    updateFields.push(`updated_by = $${idx++}`);
    updateValues.push(user_id);
    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `UPDATE construction_checklist SET ${updateFields.join(', ')} 
       WHERE construction_checklist_id = $${idx}`,
      [...updateValues, construction_checklist_id]
    );

    const responseQuery = `
      SELECT
        cc.construction_checklist_id,
        cc.company_id,
        cc.builder_id,
        cc.builder,
        cc.name,
        cc.sort_order,
        cc.data_required,
        cc.supplier,
        cc.claim,
        cc.dependent,
        cc.no_of_days,
        cc.notify,
        cc.milestone,
        cc.attachment_mandatory,
        cc.attachment_mandatory_name,
       
        json_build_object(
          'id', ct.construction_type_id,
          'name', ct.types_name
        ) AS construction_type,
        json_build_object(
          'id', cs.construction_stage,
          'name', cs.stage_name
        ) AS construction_stage,
        json_build_object(
          'id', st.supplier_type_id,
          'name', st.name
        ) AS supplier_type,
        json_build_object(
          'id', b.builder_id,
          'name', b.name
        ) AS builder,
        json_build_object(
          'id', cc_name.cost_center_id,
          'name', cc_name.name
        ) AS cost_center,
        json_build_object(
          'id', co.construction_option_id,
          'name', co.option_name
        ) AS construction_option,
        json_build_object(
          'id', cpt.compliance_type_id,
          'name', cpt.name
        ) AS compliance_type,
        u.name AS created_by_name,
         cc.created_by,
        cc.updated_by,
        cc.created_at,
        cc.updated_at
      FROM construction_checklist cc
      LEFT JOIN construction_type ct ON ct.construction_type_id = cc.construction_type_id
      LEFT JOIN construction_stage cs ON cs.construction_stage = cc.construction_stage_id
      LEFT JOIN supplier_type st ON st.supplier_type_id = cc.supplier_type_id
      LEFT JOIN builder b ON b.builder_id = cc.builder
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = cc.cost_center_id
      LEFT JOIN construction_option co ON co.construction_option_id = cc.construction_option_id
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      WHERE cc.construction_checklist_id = $1;
    `;

    const responseResult = await client.query(responseQuery, [construction_checklist_id]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction checklist updated successfully."
    );
  } catch (error) {
    console.error("Update Construction Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};

exports.deleteConstructionChecklist = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_checklist_id } = req.params;
    const { company_id, builder_id } = req.user;

    if (!construction_checklist_id) {
      return errorResponse(res, 400, "construction_checklist_id is required.");
    }

    const checkResult = await client.query(
      `SELECT construction_checklist_id FROM construction_checklist 
       WHERE construction_checklist_id = $1 
         AND (company_id = $2 OR builder_id = $3)`,
      [construction_checklist_id, company_id, builder_id]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Construction checklist not found.");
    }

    const deletedRecord = await client.query(
      `SELECT sort_order FROM construction_checklist 
       WHERE construction_checklist_id = $1`,
      [construction_checklist_id]
    );
    const deletedSortOrder = deletedRecord.rows[0].sort_order;

    await client.query(
      `DELETE FROM construction_checklist WHERE construction_checklist_id = $1`,
      [construction_checklist_id]
    );

    await client.query(
      `UPDATE construction_checklist 
       SET sort_order = sort_order - 1 
       WHERE company_id = $1 AND builder_id = $2 AND sort_order > $3`,
      [company_id, builder_id, deletedSortOrder]
    );

    return successResponse(
      res,
      {},
      "Construction checklist deleted successfully."
    );
  } catch (error) {
    console.error("Delete Construction Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
