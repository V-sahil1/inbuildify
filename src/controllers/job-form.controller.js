const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobForm = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      leads_id,
      street_name,
      land_developer,
      council,
      title_volume,
      folio,
      plan_subdivision,
      site_fall,
      existing_tree,
      driveaway_location,
      any_sewer_tie,
      easements,
      buildup_area_easements,
      build_zone,
      story_id,
      finished_surface_m,
      existing_surface_m,
      filled_area_fail_m,
      max_fill_location,
      max_finished_surface_m,
      min_finished_surface_m,
      engineering_fail_m,
      fail_type,
      ceiling_height,
      eaves_location,
      lot_type,
      site_coverage_allowed,
      eaves_size,
      eaves_return,
      roof_covering,
      roof_pitch,
      flat_roof_pitch,
      parapet_wall,
      single_story,
      double_story_gf,
      double_story_ff,
      wall_over_garage,
      wall_over_lower_roof,
      all_electric,
      type_of_cooling,
      garage_door_type,
      connection,
      recycled_water,
      extra_requirement,
      three_phase,
      driveway,
      front_wall,
      between_garage_building,
      garage_side,
      other_side,
      rear,
      allowed_porch_encroachment,
      boundry_build,
      boundry_construction,
      double_story_front_wall,
      double_story_garage_side,
      double_story_other_side,
      double_story_rear,
      double_story_balcony_encroachment,
      facade_material_requirement,
      raised_porch_facade,
      parapet_walls_pitch_roof,
      parapet_walls_tray_deck_roof,
      concept_inspiration,
      plan_subdivision_engineering,
      memorandum_common_provisions,
      developer_guidelines,
      contact_for_sale,
      variational_list,
      special_job_notes,
    } = req.body;

    await client.query("BEGIN");

    // Validate story_id if provided
    if (story_id) {
      const storyCheckSql = `
        SELECT dwelling_type_id, is_active
        FROM dwelling_type 
        WHERE dwelling_type_id = $1
      `;
      const storyResult = await client.query(storyCheckSql, [story_id]);

      if (storyResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid dwelling type ID");
      }

      if (!storyResult.rows[0].is_active) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Dwelling type is inactive");
      }
    }

    // Validate lead ownership
    const leadCheck = await client.query(
      `SELECT leads_id FROM leads WHERE leads_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [leads_id, req.user?.company_id, builderId]
    );

    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    // Check if job form already exists for this lead
    const existingJobFormCheck = await client.query(
      `SELECT job_form_id FROM job_form WHERE leads_id = $1 LIMIT 1`,
      [leads_id]
    );

    if (existingJobFormCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Job form already exists for this lead. Only one job form is allowed per lead.");
    }

    const sql = `
      INSERT INTO job_form (
        leads_id,
        street_name,
        land_developer,
        council,
        title_volume,
        folio,
        plan_subdivision,
        site_fall,
        existing_tree,
        driveaway_location,
        any_sewer_tie,
        easements,
        buildup_area_easements,
        build_zone,
        story_id,
        finished_surface_m,
        existing_surface_m,
        filled_area_fail_m,
        max_fill_location,
        max_finished_surface_m,
        min_finished_surface_m,
        engineering_fail_m,
        fail_type,
        ceiling_height,
        eaves_location,
        lot_type,
        site_coverage_allowed,
        eaves_size,
        eaves_return,
        roof_covering,
        roof_pitch,
        flat_roof_pitch,
        parapet_wall,
        single_story,
        double_story_gf,
        double_story_ff,
        wall_over_garage,
        wall_over_lower_roof,
        all_electric,
        type_of_cooling,
        garage_door_type,
        connection,
        recycled_water,
        extra_requirement,
        three_phase,
        driveway,
        front_wall,
        between_garage_building,
        garage_side,
        other_side,
        rear,
        allowed_porch_encroachment,
        boundry_build,
        boundry_construction,
        double_story_front_wall,
        double_story_garage_side,
        double_story_other_side,
        double_story_rear,
        double_story_balcony_encroachment,
        facade_material_requirement,
        raised_porch_facade,
        parapet_walls_pitch_roof,
        parapet_walls_tray_deck_roof,
        concept_inspiration,
        plan_subdivision_engineering,
        memorandum_common_provisions,
        developer_guidelines,
        contact_for_sale,
        variational_list,
        special_job_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70
      ) RETURNING *
    `;

    const values = [
      leads_id || null,
      street_name,
      land_developer || null,
      council || null,
      title_volume || null,
      folio || null,
      plan_subdivision || null,
      site_fall || null,
      existing_tree !== undefined ? existing_tree : null,
      driveaway_location || null,
      any_sewer_tie !== undefined ? any_sewer_tie : null,
      easements !== undefined ? easements : null,
      buildup_area_easements !== undefined ? buildup_area_easements : null,
      build_zone || null,
      story_id || null,
      finished_surface_m || null,
      existing_surface_m || null,
      filled_area_fail_m || null,
      max_fill_location || null,
      max_finished_surface_m || null,
      min_finished_surface_m || null,
      engineering_fail_m || null,
      fail_type || null,
      ceiling_height || null,
      eaves_location || null,
      lot_type || null,
      site_coverage_allowed || null,
      eaves_size || null,
      eaves_return || null,
      roof_covering || null,
      roof_pitch || null,
      flat_roof_pitch || null,
      parapet_wall || null,
      single_story || null,
      double_story_gf || null,
      double_story_ff || null,
      wall_over_garage || null,
      wall_over_lower_roof || null,
      all_electric !== undefined ? all_electric : null,
      type_of_cooling || null,
      garage_door_type || null,
      connection || null,
      recycled_water !== undefined ? recycled_water : null,
      extra_requirement || null,
      three_phase !== undefined ? three_phase : null,
      driveway || null,
      front_wall || null,
      between_garage_building || null,
      garage_side || null,
      other_side || null,
      rear || null,
      allowed_porch_encroachment || null,
      boundry_build !== undefined ? boundry_build : null,
      boundry_construction !== undefined ? boundry_construction : null,
      double_story_front_wall || null,
      double_story_garage_side || null,
      double_story_other_side || null,
      double_story_rear || null,
      double_story_balcony_encroachment || null,
      facade_material_requirement
        ? JSON.stringify(facade_material_requirement)
        : null,
      raised_porch_facade !== undefined ? raised_porch_facade : null,
      parapet_walls_pitch_roof !== undefined ? parapet_walls_pitch_roof : null,
      parapet_walls_tray_deck_roof !== undefined
        ? parapet_walls_tray_deck_roof
        : null,
      concept_inspiration !== undefined ? concept_inspiration : null,
      plan_subdivision_engineering !== undefined
        ? plan_subdivision_engineering
        : null,
      memorandum_common_provisions !== undefined
        ? memorandum_common_provisions
        : null,
      developer_guidelines !== undefined ? developer_guidelines : null,
      contact_for_sale !== undefined ? contact_for_sale : null,
      variational_list !== undefined ? variational_list : null,
      special_job_notes || null,
    ];

    const result = await client.query(sql, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job form created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create job form error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllJobForms = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { page = 1, limit = 25, search } = req.query;
    const offset = (page - 1) * limit;
    const searchFilter = `%${search?.toLowerCase() || ""}%`;

    const sql = `
      SELECT 
        jf.*,
        ld.leads_id,
        ld.name,
        ld.email,
        ld.phone
      FROM job_form jf
      LEFT JOIN leads ld ON jf.leads_id = ld.leads_id
      WHERE $1::text IS NULL OR 
        jf.street_name ILIKE $1::text OR 
        ld.name ILIKE $1::text OR 
        ld.email ILIKE $1::text OR 
        ld.phone ILIKE $1::text
      ORDER BY jf.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await client.query(sql, [
      searchFilter || null,
      parseInt(limit),
      offset,
    ]);

    const countSql = `
      SELECT COUNT(*)::int
      FROM job_form jf
      LEFT JOIN leads ld ON jf.leads_id = ld.leads_id
      WHERE $1::text IS NULL OR 
        jf.street_name ILIKE $1::text OR 
        ld.name ILIKE $1::text OR 
        ld.email ILIKE $1::text OR 
        ld.phone ILIKE $1::text
    `;

    const countResult = await client.query(countSql, [searchFilter || null]);

    const total = countResult.rows[0].count;
    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      {
        jobForms: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
      "Job forms retrieved successfully",
    );
  } catch (error) {
    console.error("Get all job forms error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getJobFormById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_form_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const sql = `
      SELECT 
        jf.*,
        ld.leads_id,
        ld.name,
        ld.email,
        ld.phone
      FROM job_form jf
      LEFT JOIN leads ld ON jf.leads_id = ld.leads_id
      WHERE jf.job_form_id = $1 AND (
        (ld.company_id = $2 AND $2 IS NOT NULL)
        OR (ld.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;

    const result = await client.query(sql, [job_form_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return successResponse(res, [], "Job form retrieved successfully.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job form retrieved successfully",
    );
  } catch (error) {
    console.error("Get job form by ID error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobForm = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_form_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    // Check if job form exists and belongs to user's organization
    const checkSql = `
      SELECT jf.job_form_id 
      FROM job_form jf 
      LEFT JOIN leads ld ON jf.leads_id = ld.leads_id
      WHERE jf.job_form_id = $1 AND (
        (ld.company_id = $2 AND $2 IS NOT NULL)
        OR (ld.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;

    const checkResult = await client.query(checkSql, [job_form_id, req.user?.company_id, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "Job form not found or does not belong to your organization");
    }

    await client.query("BEGIN");

    // Validate story_id if provided in update
    if (req.body.story_id) {
      const storyCheckSql = `
        SELECT dwelling_type_id, is_active
        FROM dwelling_type 
        WHERE dwelling_type_id = $1
      `;
      const storyResult = await client.query(storyCheckSql, [
        req.body.story_id,
      ]);

      if (storyResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid dwelling type ID");
      }

      if (!storyResult.rows[0].is_active) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Dwelling type is inactive");
      }
    }

    const {
      street_name,
      land_developer,
      council,
      title_volume,
      folio,
      plan_subdivision,
      site_fall,
      existing_tree,
      driveaway_location,
      any_sewer_tie,
      easements,
      buildup_area_easements,
      build_zone,
      story_id,
      finished_surface_m,
      existing_surface_m,
      filled_area_fail_m,
      max_fill_location,
      max_finished_surface_m,
      min_finished_surface_m,
      engineering_fail_m,
      fail_type,
      ceiling_height,
      eaves_location,
      lot_type,
      site_coverage_allowed,
      eaves_size,
      eaves_return,
      roof_covering,
      roof_pitch,
      flat_roof_pitch,
      parapet_wall,
      single_story,
      double_story_gf,
      double_story_ff,
      wall_over_garage,
      wall_over_lower_roof,
      all_electric,
      type_of_cooling,
      garage_door_type,
      connection,
      recycled_water,
      extra_requirement,
      three_phase,
      driveway,
      front_wall,
      between_garage_building,
      garage_side,
      other_side,
      rear,
      allowed_porch_encroachment,
      boundry_build,
      boundry_construction,
      double_story_front_wall,
      double_story_garage_side,
      double_story_other_side,
      double_story_rear,
      double_story_balcony_encroachment,
      facade_material_requirement,
      raised_porch_facade,
      parapet_walls_pitch_roof,
      parapet_walls_tray_deck_roof,
      concept_inspiration,
      plan_subdivision_engineering,
      memorandum_common_provisions,
      developer_guidelines,
      contact_for_sale,
      variational_list,
      special_job_notes,
    } = req.body;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "street_name",
      "land_developer",
      "council",
      "title_volume",
      "folio",
      "plan_subdivision",
      "site_fall",
      "existing_tree",
      "driveaway_location",
      "any_sewer_tie",
      "easements",
      "buildup_area_easements",
      "build_zone",
      "story_id",
      "finished_surface_m",
      "existing_surface_m",
      "filled_area_fail_m",
      "max_fill_location",
      "max_finished_surface_m",
      "min_finished_surface_m",
      "engineering_fail_m",
      "fail_type",
      "ceiling_height",
      "eaves_location",
      "lot_type",
      "site_coverage_allowed",
      "eaves_size",
      "eaves_return",
      "roof_covering",
      "roof_pitch",
      "flat_roof_pitch",
      "parapet_wall",
      "single_story",
      "double_story_gf",
      "double_story_ff",
      "wall_over_garage",
      "wall_over_lower_roof",
      "all_electric",
      "type_of_cooling",
      "garage_door_type",
      "connection",
      "recycled_water",
      "extra_requirement",
      "three_phase",
      "driveway",
      "front_wall",
      "between_garage_building",
      "garage_side",
      "other_side",
      "rear",
      "allowed_porch_encroachment",
      "boundry_build",
      "boundry_construction",
      "double_story_front_wall",
      "double_story_garage_side",
      "double_story_other_side",
      "double_story_rear",
      "double_story_balcony_encroachment",
      "facade_material_requirement",
      "raised_porch_facade",
      "parapet_walls_pitch_roof",
      "parapet_walls_tray_deck_roof",
      "concept_inspiration",
      "plan_subdivision_engineering",
      "memorandum_common_provisions",
      "developer_guidelines",
      "contact_for_sale",
      "variational_list",
      "special_job_notes",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);

        // Special handling for facade_material_requirement JSON field
        if (field === "facade_material_requirement") {
          updateValues.push(
            req.body[field] ? JSON.stringify(req.body[field]) : null,
          );
        } else if (
          [
            "existing_tree",
            "any_sewer_tie",
            "easements",
            "buildup_area_easements",
            "boundry_build",
            "boundry_construction",
            "all_electric",
            "recycled_water",
            "raised_porch_facade",
            "parapet_walls_pitch_roof",
            "parapet_walls_tray_deck_roof",
            "concept_inspiration",
            "plan_subdivision_engineering",
            "memorandum_common_provisions",
            "developer_guidelines",
            "contact_for_sale",
            "variational_list",
          ].includes(field)
        ) {
          updateValues.push(req.body[field] === null ? null : req.body[field]);
        } else {
          updateValues.push(req.body[field] || null);
        }
      }
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields to update");
    }

    updateFields.push(`updated_at = NOW()`);

    const updateSql = `
      UPDATE job_form 
      SET ${updateFields.join(", ")}
      WHERE job_form_id = $${paramIndex}
    `;

    updateValues.push(job_form_id);

    await client.query(updateSql, updateValues);
    await client.query("COMMIT");

    // Fetch updated record
    const selectSql = `
      SELECT * FROM job_form WHERE job_form_id = $1
    `;
    const result = await client.query(selectSql, [job_form_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job form updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update job form error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteJobForm = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { job_form_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    // Check if job form exists and belongs to user's organization
    const checkSql = `
      SELECT jf.job_form_id 
      FROM job_form jf 
      LEFT JOIN leads ld ON jf.leads_id = ld.leads_id
      WHERE jf.job_form_id = $1 AND (
        (ld.company_id = $2 AND $2 IS NOT NULL)
        OR (ld.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;

    const checkResult = await client.query(checkSql, [job_form_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "Job form not found or does not belong to your organization");
    }

    await client.query("BEGIN");

    const sql = `
      DELETE FROM job_form 
      WHERE job_form_id = $1
    `;

    await client.query(sql, [job_form_id]);
    await client.query("COMMIT");

    return successResponse(res, null, "Job form deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete job form error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
