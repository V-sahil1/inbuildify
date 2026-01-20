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
      cost_center_id = [],
      construction_option_id = [],
      compliance_type_id,
      builder,
    } = req.body;

    const { user_id, company_id, builder_id } = req.user;

    if (!name) {
      return errorResponse(res, 400, "Name is required");
    }

    if (construction_type_id) {
      const check = await client.query(
        `SELECT 1 FROM construction_type WHERE construction_type_id = $1 AND builder_id = $2`,
        [construction_type_id, builder_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid construction_type_id");
    }

    if (construction_stage_id) {
      const check = await client.query(
        `SELECT 1 FROM construction_stage WHERE construction_stage = $1 AND builder_id = $2`,
        [construction_stage_id, builder_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid construction_stage_id");
    }

    if (supplier_type_id) {
      const check = await client.query(
        `SELECT 1 FROM supplier_type WHERE supplier_type_id = $1 AND builder_id = $2`,
        [supplier_type_id, builder_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid supplier_type_id");
    }

    if (Array.isArray(cost_center_id) && cost_center_id.length) {
      const check = await client.query(
        `SELECT cost_center_id FROM cost_center WHERE cost_center_id = ANY($1::uuid[]) AND builder_id = $2`,
        [cost_center_id, builder_id],
      );
      if (check.rowCount !== cost_center_id.length) {
        return errorResponse(
          res,
          400,
          "One or more cost_center_id are invalid",
        );
      }
    }

    if (
      Array.isArray(construction_option_id) &&
      construction_option_id.length
    ) {
      const check = await client.query(
        `SELECT construction_option_id FROM construction_option WHERE construction_option_id = ANY($1::uuid[]) AND builder_id = $2`,
        [construction_option_id, builder_id],
      );
      if (check.rowCount !== construction_option_id.length) {
        return errorResponse(
          res,
          400,
          "One or more construction_option_id are invalid",
        );
      }
    }

    if (compliance_type_id) {
      const check = await client.query(
        `SELECT 1 FROM compliance_type WHERE compliance_type_id = $1`,
        [compliance_type_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid compliance_type_id");
    }

    if (builder) {
      const check = await client.query(
        `SELECT 1 FROM builder WHERE builder_id = $1`,
        [builder],
      );
      if (!check.rowCount) return errorResponse(res, 400, "Invalid builder");
    }

    if (data_required === false && no_of_days) {
      return errorResponse(
        res,
        400,
        "no_of_days cannot be set when data_required is false",
      );
    }

    if (attachment_mandatory === false && attachment_mandatory_name) {
      return errorResponse(
        res,
        400,
        "attachment_mandatory_name cannot be set when attachment_mandatory is false",
      );
    }

    const newSortOrder = sort_order || 1;
    await client.query(
      `
      UPDATE construction_checklist
      SET sort_order = sort_order + 1
      WHERE company_id = $1 AND builder_id = $2 AND sort_order >= $3
      `,
      [company_id, builder_id, newSortOrder],
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
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      RETURNING construction_checklist_id
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
        data_required ?? true,
        supplier ?? true,
        claim ?? false,
        dependent ?? false,
        no_of_days,
        notify ?? false,
        milestone ?? false,
        attachment_mandatory ?? false,
        attachment_mandatory_name || null,
        cost_center_id,
        construction_option_id,
        compliance_type_id || null,
        user_id,
        user_id,
      ],
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
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', cc_name.cost_center_id,
              'name', cc_name.name
            )
          ) FILTER (WHERE cc_name.cost_center_id IS NOT NULL),
          '[]'
        ) AS cost_center,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', co.construction_option_id,
              'name', co.option_name
            )
          ) FILTER (WHERE co.construction_option_id IS NOT NULL),
          '[]'
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
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = ANY(cc.cost_center_id)
      LEFT JOIN construction_option co ON co.construction_option_id = ANY(cc.construction_option_id)
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      WHERE cc.construction_checklist_id = $1
      GROUP BY 
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
        ct.construction_type_id,
        ct.types_name,
        cs.construction_stage,
        cs.stage_name,
        st.supplier_type_id,
        st.name,
        b.builder_id,
        b.name,
        cpt.compliance_type_id,
        cpt.name,
        u.name,
        cc.created_by,
        cc.updated_by,
        cc.created_at,
        cc.updated_at
    `;

    const response = await client.query(responseQuery, [
      insertResult.rows[0].construction_checklist_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(response.rows[0]),
      "Construction checklist created successfully.",
    );
  } catch (error) {
    console.error("Create Construction Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
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
      builder,
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

    if (builder) {
      whereClause += ` AND cc.builder = $${paramIndex++}`;
      values.push(builder);
    }

    const dataQuery = `
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
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', cc_name.cost_center_id,
              'name', cc_name.name
            )
          ) FILTER (WHERE cc_name.cost_center_id IS NOT NULL),
          '[]'
        ) AS cost_center,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', co.construction_option_id,
              'name', co.option_name
            )
          ) FILTER (WHERE co.construction_option_id IS NOT NULL),
          '[]'
        ) AS construction_option,
        json_build_object(
          'id', cpt.compliance_type_id,
          'name', cpt.name
        ) AS compliance_type,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'constructionChecklistPredecessorId', ccp.construction_checklist_predecessor_id,
            'constructionChecklistId', ccp.construction_checklist_id,
            'predecessorChecklistId', ccp.predecessor_checklist_id,
            'predecessorChecklistName', pred_cc.name,
            'offSet', ccp.off_set,
            'duration', ccp.duration
          )), '[]'::json)
          FROM construction_checklist_predecessor ccp
          LEFT JOIN construction_checklist pred_cc ON pred_cc.construction_checklist_id = ccp.predecessor_checklist_id
          WHERE ccp.construction_checklist_id = cc.construction_checklist_id
            AND ccp.predecessor_checklist_id IS NOT NULL
        ) AS predecessor
      FROM construction_checklist cc
      LEFT JOIN construction_type ct ON ct.construction_type_id = cc.construction_type_id
      LEFT JOIN construction_stage cs ON cs.construction_stage = cc.construction_stage_id
      LEFT JOIN supplier_type st ON st.supplier_type_id = cc.supplier_type_id
      LEFT JOIN builder b ON b.builder_id = cc.builder
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = ANY(cc.cost_center_id)
      LEFT JOIN construction_option co ON co.construction_option_id = ANY(cc.construction_option_id)
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      ${whereClause}
      GROUP BY 
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
        ct.construction_type_id,
        ct.types_name,
        cs.construction_stage,
        cs.stage_name,
        st.supplier_type_id,
        st.name,
        b.builder_id,
        b.name,
        cpt.compliance_type_id,
        cpt.name,
        u.name,
        cc.created_by,
        cc.updated_by,
        cc.created_at,
        cc.updated_at
      ORDER BY cc.sort_order ASC, cc.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataResult = await client.query(dataQuery, [
      ...values,
      limitValue,
      offset,
    ]);

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
      "Construction checklists fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Construction Checklists Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
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
      "Construction checklist fetched successfully.",
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
      builder,
      po_folder_id,
      job_documents_folder_id,
    } = req.body;

    const { user_id, company_id, builder_id } = req.user;

    if (!construction_checklist_id) {
      return errorResponse(res, 400, "construction_checklist_id is required.");
    }

    const existingResult = await client.query(
      `SELECT construction_checklist_id 
       FROM construction_checklist 
       WHERE construction_checklist_id = $1 
         AND (company_id = $2 OR builder_id = $3)`,
      [construction_checklist_id, company_id, builder_id],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(res, 404, "Construction checklist not found.");
    }

    if (construction_type_id) {
      const check = await client.query(
        `SELECT 1 FROM construction_type WHERE construction_type_id = $1`,
        [construction_type_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid construction_type_id");
    }

    if (construction_stage_id) {
      const check = await client.query(
        `SELECT 1 FROM construction_stage WHERE construction_stage = $1`,
        [construction_stage_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid construction_stage_id");
    }

    if (supplier_type_id) {
      const check = await client.query(
        `SELECT 1 FROM supplier_type WHERE supplier_type_id = $1`,
        [supplier_type_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid supplier_type_id");
    }

    if (Array.isArray(cost_center_id) && cost_center_id.length) {
      const check = await client.query(
        `SELECT cost_center_id 
         FROM cost_center 
         WHERE cost_center_id = ANY($1::uuid[])`,
        [cost_center_id],
      );
      if (check.rowCount !== cost_center_id.length) {
        return errorResponse(
          res,
          400,
          "One or more cost_center_id are invalid",
        );
      }
    }

    if (
      Array.isArray(construction_option_id) &&
      construction_option_id.length
    ) {
      const check = await client.query(
        `SELECT construction_option_id 
         FROM construction_option 
         WHERE construction_option_id = ANY($1::uuid[])`,
        [construction_option_id],
      );
      if (check.rowCount !== construction_option_id.length) {
        return errorResponse(
          res,
          400,
          "One or more construction_option_id are invalid",
        );
      }
    }

    if (compliance_type_id) {
      const check = await client.query(
        `SELECT 1 FROM compliance_type WHERE compliance_type_id = $1`,
        [compliance_type_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid compliance_type_id");
    }

    if (builder) {
      const check = await client.query(
        `SELECT 1 FROM builder WHERE builder_id = $1`,
        [builder],
      );
      if (!check.rowCount) return errorResponse(res, 400, "Invalid builder");
    }

    if (po_folder_id) {
      const check = await client.query(
        `SELECT 1 FROM document_common_folder WHERE document_common_folder_id = $1`,
        [po_folder_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid po_folder_id");
    }

    if (job_documents_folder_id) {
      const check = await client.query(
        `SELECT 1 FROM document_common_folder WHERE document_common_folder_id = $1`,
        [job_documents_folder_id],
      );
      if (!check.rowCount)
        return errorResponse(res, 400, "Invalid job_documents_folder_id");
    }

    const currentRecord = await client.query(
      `SELECT data_required, attachment_mandatory 
       FROM construction_checklist 
       WHERE construction_checklist_id = $1`,
      [construction_checklist_id],
    );

    const currentData = currentRecord.rows[0];
    const newDataRequired =
      data_required !== undefined ? data_required : currentData.data_required;
    const newAttachmentMandatory =
      attachment_mandatory !== undefined
        ? attachment_mandatory
        : currentData.attachment_mandatory;

    if (newDataRequired === false && no_of_days !== undefined && no_of_days) {
      return errorResponse(
        res,
        400,
        "no_of_days cannot be set when data_required is false",
      );
    }

    if (
      newAttachmentMandatory === false &&
      attachment_mandatory_name !== undefined &&
      attachment_mandatory_name
    ) {
      return errorResponse(
        res,
        400,
        "attachment_mandatory_name cannot be set when attachment_mandatory is false",
      );
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (data_required === false && currentData.data_required === true) {
      updateFields.push(`no_of_days = $${idx++}`);
      updateValues.push(null);
    }

    if (
      attachment_mandatory === false &&
      currentData.attachment_mandatory === true
    ) {
      updateFields.push(`attachment_mandatory_name = $${idx++}`);
      updateValues.push(null);
    }

    if (name !== undefined) {
      if (!name) return errorResponse(res, 400, "Name cannot be empty");
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
      updateValues.push(cost_center_id || []);
    }

    if (construction_option_id !== undefined) {
      updateFields.push(`construction_option_id = $${idx++}`);
      updateValues.push(construction_option_id || []);
    }

    if (compliance_type_id !== undefined) {
      updateFields.push(`compliance_type_id = $${idx++}`);
      updateValues.push(compliance_type_id || null);
    }

    if (builder !== undefined) {
      updateFields.push(`builder = $${idx++}`);
      updateValues.push(builder || null);
    }

    if (po_folder_id !== undefined) {
      updateFields.push(`po_folder_id = $${idx++}`);
      updateValues.push(po_folder_id || null);
    }

    if (job_documents_folder_id !== undefined) {
      updateFields.push(`job_documents_folder_id = $${idx++}`);
      updateValues.push(job_documents_folder_id || null);
    }

    if (!updateFields.length) {
      return errorResponse(
        res,
        400,
        "At least one field is required for update.",
      );
    }

    updateFields.push(`updated_by = $${idx++}`);
    updateValues.push(user_id);
    updateFields.push(`updated_at = NOW()`);

    await client.query(
      `UPDATE construction_checklist 
       SET ${updateFields.join(", ")} 
       WHERE construction_checklist_id = $${idx}`,
      [...updateValues, construction_checklist_id],
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
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', cc_name.cost_center_id,
              'name', cc_name.name
            )
          ) FILTER (WHERE cc_name.cost_center_id IS NOT NULL),
          '[]'
        ) AS cost_center,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', co.construction_option_id,
              'name', co.option_name
            )
          ) FILTER (WHERE co.construction_option_id IS NOT NULL),
          '[]'
        ) AS construction_option,
        json_build_object(
          'id', cpt.compliance_type_id,
          'name', cpt.name
        ) AS compliance_type,
        json_build_object(
          'id', dcf.document_common_folder_id,
          'name', dcf.name
        ) AS po_folder,
        json_build_object(
          'id', dcf2.document_common_folder_id,
          'name', dcf2.name
        ) AS job_document_folder,
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
      LEFT JOIN cost_center cc_name ON cc_name.cost_center_id = ANY(cc.cost_center_id)
      LEFT JOIN construction_option co ON co.construction_option_id = ANY(cc.construction_option_id)
      LEFT JOIN compliance_type cpt ON cpt.compliance_type_id = cc.compliance_type_id
      LEFT JOIN document_common_folder dcf ON dcf.document_common_folder_id = cc.po_folder_id
      LEFT JOIN document_common_folder dcf2 ON dcf2.document_common_folder_id = cc.job_documents_folder_id
      LEFT JOIN users u ON u.users_id = cc.created_by
      WHERE cc.construction_checklist_id = $1
      GROUP BY 
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
        ct.construction_type_id,
        ct.types_name,
        cs.construction_stage,
        cs.stage_name,
        st.supplier_type_id,
        st.name,
        b.builder_id,
        b.name,
        cpt.compliance_type_id,
        cpt.name,
        dcf.document_common_folder_id,
        dcf.name,
        dcf2.document_common_folder_id,
        dcf2.name,
        u.name,
        cc.created_by,
        cc.updated_by,
        cc.created_at,
        cc.updated_at
    `;

    const responseResult = await client.query(responseQuery, [
      construction_checklist_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Construction checklist updated successfully.",
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
      [construction_checklist_id, company_id, builder_id],
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Construction checklist not found.");
    }

    const deletedRecord = await client.query(
      `SELECT sort_order FROM construction_checklist 
       WHERE construction_checklist_id = $1`,
      [construction_checklist_id],
    );
    const deletedSortOrder = deletedRecord.rows[0].sort_order;

    await client.query(
      `DELETE FROM construction_checklist WHERE construction_checklist_id = $1`,
      [construction_checklist_id],
    );

    await client.query(
      `UPDATE construction_checklist 
       SET sort_order = sort_order - 1 
       WHERE company_id = $1 AND builder_id = $2 AND sort_order > $3`,
      [company_id, builder_id, deletedSortOrder],
    );

    return successResponse(
      res,
      {},
      "Construction checklist deleted successfully.",
    );
  } catch (error) {
    console.error("Delete Construction Checklist Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
};
