import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

const formatInspectionChecklistResponse = (row) => {
  const base = {
    constructionInspectionChecklistId: row.constructionInspectionChecklistId,
    fieldName: row.fieldName,
    description: row.description,
    sortOrder: row.sortOrder,
    addAllExistingJobs: row.addAllExistingJobs,
    constructionOptionId:
      row.constructionOptionId || row.construction_option_id || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (row.fieldName === "section") {
    return {
      ...base,
      builder: row.builder,
      constructionType: row.constructionType,
      constructionStage: row.constructionStage,
    };
  }

  // checklist
  return {
    ...base,
    sectionId: row.section?.id || null,
  };
};

export async function createConstructionInspectionChecklist(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      builder,
      construction_type_id,
      construction_stage_id,
      field_name,
      description,
      sort_order,
      construction_option_id,
      section_id,
      add_all_existing_jobs,
    } = req.body;

    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    if (!field_name || !description) {
      return errorResponse(res, 400, "field_name and description are required");
    }

    if (!["checklist", "section"].includes(field_name)) {
      return errorResponse(
        res,
        400,
        "field_name must be either 'checklist' or 'section'",
      );
    }

    if (field_name === "checklist" && !section_id) {
      return errorResponse(
        res,
        400,
        "section_id is required when field_name is 'checklist'",
      );
    }

    if (!companyId && !builderId) {
      return errorResponse(
        res,
        400,
        "User must be associated with either company or builder",
      );
    }

    const finalSortOrder = sort_order || 1;

    if (field_name === "section") {
      const allowedSectionFields = [
        "builder",
        "construction_type_id",
        "construction_stage_id",
        "field_name",
        "description",
        "sort_order",
        "add_all_existing_jobs",
      ];
      const providedFields = Object.keys(req.body);

      for (const field of providedFields) {
        if (
          !allowedSectionFields.includes(field) &&
          req.body[field] !== undefined
        ) {
          return errorResponse(
            res,
            400,
            `Field '${field}' is not allowed when field_name is 'section'. Only allowed fields: ${allowedSectionFields.join(
              ", ",
            )}`,
          );
        }
      }

      if (!builder) {
        return errorResponse(
          res,
          400,
          "builder is required when field_name is 'section'",
        );
      }

      if (!construction_type_id) {
        return errorResponse(
          res,
          400,
          "construction_type_id is required when field_name is 'section'",
        );
      }

      if (!construction_stage_id) {
        return errorResponse(
          res,
          400,
          "construction_stage_id is required when field_name is 'section'",
        );
      }

      const shiftSectionsQuery = `
        UPDATE construction_inspection_checklist 
        SET sort_order = sort_order + 1 
        WHERE field_name = 'section' 
          AND (company_id = $1 OR builder_id = $2)
          AND builder = $3 
          AND construction_type_id = $4 
          AND construction_stage_id = $5
          AND sort_order >= $6
      `;
      await client.query(shiftSectionsQuery, [
        companyId,
        builderId,
        builder,
        construction_type_id,
        construction_stage_id,
        finalSortOrder,
      ]);
    } else if (field_name === "checklist") {
      if (section_id) {
        const sectionCheckQuery = `
          SELECT * FROM construction_inspection_checklist 
          WHERE construction_inspection_checklist_id = $1 
            AND field_name = 'section'
            AND (company_id = $2 OR builder_id = $3)
        `;
        const sectionResult = await client.query(sectionCheckQuery, [
          section_id,
          companyId,
          builderId,
        ]);

        if (sectionResult.rowCount === 0) {
          return errorResponse(res, 400, "Section not found or access denied");
        }
      } else {
        const sectionExistsQuery = `
          SELECT * FROM construction_inspection_checklist 
          WHERE field_name = 'section'
            AND (company_id = $1 OR builder_id = $2)
          LIMIT 1
        `;
        const sectionExistsResult = await client.query(sectionExistsQuery, [
          companyId,
          builderId,
        ]);

        if (sectionExistsResult.rowCount === 0) {
          return errorResponse(
            res,
            400,
            "Cannot create checklist. No sections found. Please create a section first.",
          );
        }
      }

      const shiftChecklistsQuery = `
        UPDATE construction_inspection_checklist 
        SET sort_order = sort_order + 1 
        WHERE field_name = 'checklist' 
          AND (company_id = $1 OR builder_id = $2)
          AND sort_order >= $3
      `;
      await client.query(shiftChecklistsQuery, [
        companyId,
        builderId,
        finalSortOrder,
      ]);
    }

    if (field_name === "checklist" && section_id) {
      const duplicateCheckQuery = `
        SELECT 1
        FROM construction_inspection_checklist
        WHERE section_id = $1 
          AND LOWER(description) = LOWER($2)
          AND (company_id = $3 OR builder_id = $4)
      `;
      const duplicateResult = await client.query(duplicateCheckQuery, [
        section_id,
        description.trim(),
        companyId,
        builderId,
      ]);

      if (duplicateResult.rowCount > 0) {
        return errorResponse(
          res,
          400,
          "Checklist with this name already exists in this section",
        );
      }
    }

    const insertQuery = `
      INSERT INTO construction_inspection_checklist (
        company_id,
        builder_id,
        builder,
        construction_type_id,
        construction_stage_id,
        field_name,
        description,
        sort_order,
        construction_option_id,
        section_id,
        add_all_existing_jobs,
        created_by,
        updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *;
    `;

    const values = [
      companyId || null,
      builderId || null,
      builder || null,
      construction_type_id || null,
      construction_stage_id || null,
      field_name,
      description,
      finalSortOrder,
      construction_option_id || null,
      section_id || null,
      add_all_existing_jobs !== undefined ? add_all_existing_jobs : true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    const inspectionChecklistId =
      result.rows[0].construction_inspection_checklist_id;

    const responseQuery = `
     SELECT
  cic.construction_inspection_checklist_id,
  cic.field_name,
  cic.description,
  cic.sort_order,
  cic.add_all_existing_jobs,
  cic.construction_option_id,

  json_build_object(
    'id', cic.builder,
    'name', b.name
  ) AS builder,

  json_build_object(
    'id', cic.construction_type_id,
    'name', ct.types_name
  ) AS construction_type,

  json_build_object(
    'id', cic.construction_stage_id,
    'name', cs.stage_name
  ) AS construction_stage,

  json_build_object(
    'id', cic.section_id,
    'name', section.description
  ) AS section,

  cic.created_at,
  cic.updated_at

FROM construction_inspection_checklist cic
LEFT JOIN construction_type ct ON cic.construction_type_id = ct.construction_type_id
LEFT JOIN construction_stage cs ON cic.construction_stage_id = cs.construction_stage
LEFT JOIN construction_inspection_checklist section
  ON cic.section_id = section.construction_inspection_checklist_id
LEFT JOIN builder b ON cic.builder = b.builder_id
WHERE cic.construction_inspection_checklist_id = $1;

    `;

    const responseResult = await client.query(responseQuery, [
      inspectionChecklistId,
    ]);

    const formatted = formatInspectionChecklistResponse(
      keysToCamelCase(responseResult.rows[0]),
    );

    return successResponse(
      res,
      formatted,
      "Construction inspection checklist created successfully",
    );
  } catch (error) {
    console.error("Error creating construction inspection checklist:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function getConstructionInspectionChecklists(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { construction_type_id, construction_stage_id, builder, field_name } =
      req.query;

    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    let query = `
      SELECT 
        cic.construction_inspection_checklist_id,
        cic.field_name,
        cic.description,
        cic.sort_order,
        cic.add_all_existing_jobs,
        cic.construction_option_id,

        json_build_object(
          'id', cic.builder,
          'name', b.name
        ) AS builder,

        json_build_object(
          'id', cic.construction_type_id,
          'name', ct.types_name
        ) AS construction_type,

        json_build_object(
          'id', cic.construction_stage_id,
          'name', cs.stage_name
        ) AS construction_stage,

        json_build_object(
          'id', cic.section_id,
          'name', sec.description
        ) AS section,

        cic.created_at,
        cic.updated_at

      FROM construction_inspection_checklist cic
      LEFT JOIN construction_type ct 
        ON cic.construction_type_id = ct.construction_type_id
      LEFT JOIN construction_stage cs 
        ON cic.construction_stage_id = cs.construction_stage
      LEFT JOIN construction_option co 
        ON cic.construction_option_id = co.construction_option_id
      LEFT JOIN construction_inspection_checklist sec 
        ON cic.section_id = sec.construction_inspection_checklist_id
      LEFT JOIN builder b 
        ON cic.builder = b.builder_id
      WHERE 1 = 1
    `;

    const values = [];
    let paramIndex = 1;

    if (companyId) {
      query += ` AND cic.company_id = $${paramIndex++}`;
      values.push(companyId);
    }

    if (builderId) {
      query += ` AND cic.builder_id = $${paramIndex++}`;
      values.push(builderId);
    }

    if (builder) {
      query += ` AND cic.builder = $${paramIndex++}`;
      values.push(builder);
    }

    if (construction_type_id) {
      query += ` AND cic.construction_type_id = $${paramIndex++}`;
      values.push(construction_type_id);
    }

    if (construction_stage_id) {
      query += ` AND cic.construction_stage_id = $${paramIndex++}`;
      values.push(construction_stage_id);
    }

    if (field_name) {
      query += ` AND cic.field_name = $${paramIndex++}`;
      values.push(field_name);
    }

    query += " ORDER BY cic.sort_order, cic.created_at";

    const result = await client.query(query, values);

    const formatted = keysToCamelCase(result.rows).map(
      formatInspectionChecklistResponse,
    );

    return successResponse(
      res,
      formatted,
      "Construction inspection checklists fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching construction inspection checklists:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateConstructionInspectionChecklist(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const {
      builder,
      construction_type_id,
      construction_stage_id,
      field_name,
      description,
      sort_order,
      construction_option_id,
      section_id,
      add_all_existing_jobs,
    } = req.body;

    if (field_name && !["checklist", "section"].includes(field_name)) {
      return errorResponse(
        res,
        400,
        "field_name must be either 'checklist' or 'section'",
      );
    }

    const checkQuery = "SELECT * FROM construction_inspection_checklist WHERE construction_inspection_checklist_id = $1 AND (company_id = $2 OR builder_id = $3)";
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction inspection checklist not found or access denied",
      );
    }

    const existingRecord = checkResult.rows[0];
    const updatedFieldName =
      field_name !== undefined ? field_name : existingRecord.field_name;
    const updatedSortOrder =
      sort_order !== undefined ? sort_order : existingRecord.sort_order;

    if (updatedFieldName === "checklist") {
      if (section_id !== undefined) {
        if (section_id) {
          const sectionCheckQuery = `
            SELECT * FROM construction_inspection_checklist 
            WHERE construction_inspection_checklist_id = $1 
              AND field_name = 'section'
              AND (company_id = $2 OR builder_id = $3)
          `;
          const sectionResult = await client.query(sectionCheckQuery, [
            section_id,
            companyId,
            builderId,
          ]);

          if (sectionResult.rowCount === 0) {
            return errorResponse(
              res,
              400,
              "Section not found or access denied",
            );
          }
        } else {
          const sectionExistsQuery = `
            SELECT * FROM construction_inspection_checklist 
            WHERE field_name = 'section'
              AND (company_id = $1 OR builder_id = $2)
            LIMIT 1
          `;
          const sectionExistsResult = await client.query(sectionExistsQuery, [
            companyId,
            builderId,
          ]);

          if (sectionExistsResult.rowCount === 0) {
            return errorResponse(
              res,
              400,
              "Cannot create checklist. No sections found. Please create a section first.",
            );
          }
        }
      } else if (!existingRecord.section_id) {
        const sectionExistsQuery = `
          SELECT * FROM construction_inspection_checklist 
          WHERE field_name = 'section'
            AND (company_id = $1 OR builder_id = $2)
          LIMIT 1
        `;
        const sectionExistsResult = await client.query(sectionExistsQuery, [
          companyId,
          builderId,
        ]);

        if (sectionExistsResult.rowCount === 0) {
          return errorResponse(
            res,
            400,
            "Cannot create checklist. No sections found. Please create a section first.",
          );
        }
      }
    }

    if (updatedFieldName === "section") {
      const allowedSectionFields = [
        "builder",
        "construction_type_id",
        "construction_stage_id",
        "field_name",
        "description",
        "sort_order",
        "add_all_existing_jobs",
      ];
      const providedFields = Object.keys(req.body);

      for (const field of providedFields) {
        if (
          !allowedSectionFields.includes(field) &&
          req.body[field] !== undefined
        ) {
          return errorResponse(
            res,
            400,
            `Field '${field}' is not allowed when field_name is 'section'. Only allowed fields: ${allowedSectionFields.join(
              ", ",
            )}`,
          );
        }
      }

      if (builder !== undefined && !builder) {
        return errorResponse(
          res,
          400,
          "builder is required when field_name is 'section'",
        );
      }

      if (construction_type_id !== undefined && !construction_type_id) {
        return errorResponse(
          res,
          400,
          "construction_type_id is required when field_name is 'section'",
        );
      }

      if (construction_stage_id !== undefined && !construction_stage_id) {
        return errorResponse(
          res,
          400,
          "construction_stage_id is required when field_name is 'section'",
        );
      }
    }

    if (sort_order !== undefined && sort_order !== existingRecord.sort_order) {
      if (updatedFieldName === "section") {
        const finalBuilder =
          builder !== undefined ? builder : existingRecord.builder;
        const finalConstructionTypeId =
          construction_type_id !== undefined
            ? construction_type_id
            : existingRecord.construction_type_id;
        const finalConstructionStageId =
          construction_stage_id !== undefined
            ? construction_stage_id
            : existingRecord.construction_stage_id;

        const shiftSectionsQuery = `
          UPDATE construction_inspection_checklist 
          SET sort_order = sort_order + 1 
          WHERE field_name = 'section' 
            AND (company_id = $1 OR builder_id = $2)
            AND builder = $3 
            AND construction_type_id = $4 
            AND construction_stage_id = $5
            AND sort_order >= $6
            AND construction_inspection_checklist_id != $7
        `;
        await client.query(shiftSectionsQuery, [
          companyId,
          builderId,
          finalBuilder,
          finalConstructionTypeId,
          finalConstructionStageId,
          sort_order,
          id,
        ]);
      } else if (updatedFieldName === "checklist") {
        const shiftChecklistsQuery = `
          UPDATE construction_inspection_checklist 
          SET sort_order = sort_order + 1 
          WHERE field_name = 'checklist' 
            AND (company_id = $1 OR builder_id = $2)
            AND sort_order >= $3
            AND construction_inspection_checklist_id != $4
        `;
        await client.query(shiftChecklistsQuery, [
          companyId,
          builderId,
          sort_order,
          id,
        ]);
      }
    }

    if (description !== undefined && updatedFieldName === "checklist") {
      const currentSectionId =
        section_id !== undefined ? section_id : existingRecord.section_id;

      if (currentSectionId) {
        const duplicateCheckQuery = `
          SELECT 1
          FROM construction_inspection_checklist
          WHERE section_id = $1 
            AND LOWER(description) = LOWER($2)
            AND (company_id = $3 OR builder_id = $4)
            AND construction_inspection_checklist_id != $5
        `;
        const duplicateResult = await client.query(duplicateCheckQuery, [
          currentSectionId,
          description.trim(),
          companyId,
          builderId,
          id,
        ]);

        if (duplicateResult.rowCount > 0) {
          return errorResponse(
            res,
            400,
            "Checklist with this name already exists in this section",
          );
        }
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (builder !== undefined) {
      fields.push(`builder = $${paramIndex++}`);
      values.push(builder);
    }

    if (construction_type_id !== undefined) {
      fields.push(`construction_type_id = $${paramIndex++}`);
      values.push(construction_type_id);
    }

    if (construction_stage_id !== undefined) {
      fields.push(`construction_stage_id = $${paramIndex++}`);
      values.push(construction_stage_id);
    }

    if (field_name !== undefined) {
      fields.push(`field_name = $${paramIndex++}`);
      values.push(field_name);
    }

    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (sort_order !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(sort_order);
    }

    if (construction_option_id !== undefined) {
      fields.push(`construction_option_id = $${paramIndex++}`);
      values.push(construction_option_id);
    }

    if (section_id !== undefined) {
      fields.push(`section_id = $${paramIndex++}`);
      values.push(section_id);
    }

    if (add_all_existing_jobs !== undefined) {
      fields.push(`add_all_existing_jobs = $${paramIndex++}`);
      values.push(add_all_existing_jobs);
    }

    if (fields.length === 0) {
      return errorResponse(res, 400, "No fields provided to update");
    }

    fields.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE construction_inspection_checklist 
      SET ${fields.join(", ")}
      WHERE construction_inspection_checklist_id = $${paramIndex}
      RETURNING construction_inspection_checklist_id
    `;

    values.push(id);

    await client.query(updateQuery, values);

    const responseQuery = `
      SELECT
        cic.construction_inspection_checklist_id,
        cic.field_name,
        cic.description,
        cic.sort_order,
        cic.add_all_existing_jobs,
        cic.construction_option_id,

        json_build_object(
          'id', cic.builder,
          'name', b.name
        ) AS builder,

        json_build_object(
          'id', cic.construction_type_id,
          'name', ct.types_name
        ) AS construction_type,

        json_build_object(
          'id', cic.construction_stage_id,
          'name', cs.stage_name
        ) AS construction_stage,

        json_build_object(
          'id', cic.section_id,
          'name', section.description
        ) AS section,

        cic.created_at,
        cic.updated_at

FROM construction_inspection_checklist cic
LEFT JOIN construction_type ct ON cic.construction_type_id = ct.construction_type_id
LEFT JOIN construction_stage cs ON cic.construction_stage_id = cs.construction_stage
LEFT JOIN construction_inspection_checklist section
  ON cic.section_id = section.construction_inspection_checklist_id
LEFT JOIN builder b ON cic.builder = b.builder_id
WHERE cic.construction_inspection_checklist_id = $1
    `;

    const responseResult = await client.query(responseQuery, [id]);

    const formatted = formatInspectionChecklistResponse(
      keysToCamelCase(responseResult.rows[0]),
    );

    return successResponse(
      res,
      formatted,
      "Construction inspection checklist updated successfully",
    );
  } catch (error) {
    console.error("Error updating construction inspection checklist:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function deleteConstructionInspectionChecklist(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { add_all_existing_jobs } = req.body;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const checkQuery = "SELECT * FROM construction_inspection_checklist WHERE construction_inspection_checklist_id = $1 AND (company_id = $2 OR builder_id = $3)";
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Construction inspection checklist not found or access denied",
      );
    }

    const deleteQuery = "DELETE FROM construction_inspection_checklist WHERE construction_inspection_checklist_id = $1";
    const queryParams = [id];

    if (add_all_existing_jobs !== undefined) {
      const updateQuery = "UPDATE construction_inspection_checklist SET add_all_existing_jobs = $1 WHERE construction_inspection_checklist_id = $2";
      await client.query(updateQuery, [add_all_existing_jobs, id]);

      const updatedResult = await client.query(
        "SELECT * FROM construction_inspection_checklist WHERE construction_inspection_checklist_id = $1",
        [id],
      );

      await client.query(deleteQuery, queryParams);

      return successResponse(
        res,
        keysToCamelCase(updatedResult.rows[0]),
        "Construction inspection checklist updated and deleted successfully",
      );
    }

    await client.query(deleteQuery, queryParams);

    return successResponse(
      res,
      null,
      "Construction inspection checklist deleted successfully",
    );
  } catch (error) {
    console.error("Error deleting construction inspection checklist:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function getConstructionInspectionChecklistById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    if (!companyId && !builderId) {
      return errorResponse(
        res,
        400,
        "User must be associated with either company or builder",
      );
    }

    const responseQuery = `
      SELECT
        cic.construction_inspection_checklist_id,
        cic.field_name,
        cic.description,
        cic.sort_order,
        cic.add_all_existing_jobs,
        cic.construction_option_id,

        json_build_object(
          'id', cic.builder,
          'name', b.name
        ) AS builder,

        json_build_object(
          'id', cic.construction_type_id,
          'name', ct.types_name
        ) AS construction_type,

        json_build_object(
          'id', cic.construction_stage_id,
          'name', cs.stage_name
        ) AS construction_stage,

        json_build_object(
          'id', cic.section_id,
          'name', section.description
        ) AS section,

        cic.created_at,
        cic.updated_at

      FROM construction_inspection_checklist cic
      LEFT JOIN construction_type ct ON cic.construction_type_id = ct.construction_type_id
      LEFT JOIN construction_stage cs ON cic.construction_stage_id = cs.construction_stage
      LEFT JOIN construction_inspection_checklist section
        ON cic.section_id = section.construction_inspection_checklist_id
      LEFT JOIN builder b ON cic.builder = b.builder_id
      WHERE cic.section_id = $1 
        AND (cic.company_id = $2 OR cic.builder_id = $3)
        AND cic.field_name = 'checklist'
      ORDER BY cic.sort_order ASC;
    `;

    const result = await client.query(responseQuery, [
      id,
      companyId,
      builderId,
    ]);

    const formatted = keysToCamelCase(result.rows).map(
      formatInspectionChecklistResponse,
    );

    return successResponse(
      res,
      formatted,
      "Construction inspection checklists fetched successfully",
    );
  } catch (error) {
    console.error(
      "Error fetching construction inspection checklists by section ID:",
      error,
    );
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
