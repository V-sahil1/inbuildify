const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

/* -----------------------------
   ESTATE IMAGES
------------------------------ */

exports.getEstateImages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { estate_id } = req.query;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    let targetEstateId = estate_id;

    if (!targetEstateId) {
      const estateRes = await client.query(
        `
    SELECT estate_id
    FROM estate
    WHERE (company_id = $1 OR builder_id = $2)
    ORDER BY created_at ASC
    LIMIT 1
    `,
        [companyId, builderId],
      );

      if (estateRes.rowCount === 0) {
        const newEstate = await client.query(
          `
      INSERT INTO estate (
        name,
        company_id,
        builder_id,
        created_at
      )
      VALUES ('Default Estate', $1, $2, NOW())
      RETURNING estate_id
      `,
          [companyId, builderId],
        );

        targetEstateId = newEstate.rows[0].estate_id;
      } else {
        targetEstateId = estateRes.rows[0].estate_id;
      }
    }

    const imageExists = await client.query(
      `
      SELECT 1
      FROM estate_images
      WHERE estate_id = $1
      LIMIT 1
      `,
      [targetEstateId],
    );

    if (imageExists.rowCount === 0) {
      await client.query(
        `
        INSERT INTO estate_images (
          estate_id,
          image_url,
          uploaded_at,
          uploaded_by
        )
        VALUES ($1, NULL, NOW(), $2)
        `,
        [targetEstateId, userId],
      );
    }

    const result = await client.query(
      `
      SELECT 
        ei.estate_image_id,
        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate,
        ei.image_url,
        ei.uploaded_at,
        ei.uploaded_by
      FROM estate_images ei
      JOIN estate e ON ei.estate_id = e.estate_id
      WHERE ei.estate_id = $1
        AND (e.company_id = $2 OR e.builder_id = $3)
      ORDER BY ei.uploaded_at DESC
      `,
      [targetEstateId, companyId, builderId],
    );

    const responseData = keysToCamelCase(result.rows);
    
    // Return single object if only one record, array if multiple
    const data = responseData.length === 1 ? responseData[0] : responseData;

    return successResponse(
      res,
      data,
      "Estate images fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching estate images:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateEstateImage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const image_url =
      (req.body.imageUrl === "" ? null : req.body.imageUrl) ||
      (req.body.image_url === "" ? null : req.body.image_url);

    const checkQuery = `
      SELECT ei.*
      FROM estate_images ei
      LEFT JOIN estate e ON ei.estate_id = e.estate_id
      WHERE ei.estate_image_id = $1 
        AND (e.company_id = $2 OR e.builder_id = $3)
    `;
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Estate image not found or access denied");
    }

    const existingImage = checkResult.rows[0];

    if (image_url !== undefined) {
      if (!image_url) {
        if (existingImage.image_url) {
          await deleteFromS3(existingImage.image_url);
        }
      } else {
        if (existingImage.image_url && existingImage.image_url !== image_url) {
          await deleteFromS3(existingImage.image_url);
        }
      }
    }

    const updateQuery = `
      UPDATE estate_images 
      SET image_url = $1, uploaded_by = $2, uploaded_at = NOW()
      WHERE estate_image_id = $3
      RETURNING *
    `;

    const result = await client.query(updateQuery, [image_url, userId, id]);

    const responseQuery = `
      SELECT 
        ei.estate_image_id,
        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate,
        ei.image_url,
        ei.uploaded_at,
        ei.uploaded_by
    
      FROM estate_images ei
      LEFT JOIN users u ON ei.uploaded_by = u.users_id
      LEFT JOIN estate e ON ei.estate_id = e.estate_id
      WHERE ei.estate_image_id = $1
    `;

    const responseResult = await client.query(responseQuery, [id]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Estate image updated successfully",
    );
  } catch (error) {
    console.error("Error updating estate image:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.createEstateDocument = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { estate_id, document_name } = req.body;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    // Handle both field names for file URL - prioritize fileUrl from file upload
    const file_url =
      (req.body.fileUrl === "" ? null : req.body.fileUrl) ||
      (req.body.file_url === "" ? null : req.body.file_url);

    // Validate required fields
    if (!estate_id) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Estate ID is required");
    }
    if (!document_name) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Document name is required");
    }

    // Check if estate exists and belongs to user scope
    const estateCheck = await client.query(
      `
      SELECT estate_id, name
      FROM estate
      WHERE estate_id = $1 
        AND (company_id = $2 OR builder_id = $3)
      `,
      [estate_id, companyId, builderId],
    );

    if (estateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Estate not found or access denied");
    }

    // Check for duplicate document name within the same estate
    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM estate_documents
      WHERE estate_id = $1 
        AND LOWER(document_name) = LOWER($2)
      `,
      [estate_id, document_name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Document with this name already exists for this estate",
      );
    }

    // Create estate document
    const result = await client.query(
      `
      INSERT INTO estate_documents (
        estate_id, document_name, file_url, created_at, created_by, uploaded_at, uploaded_by
      ) VALUES ($1, $2, $3, NOW(), $4, NOW(), $5)
      RETURNING *
      `,
      [estate_id, document_name.trim(), file_url, userId, userId],
    );

    // Get response with estate information
    const responseQuery = `
      SELECT 
        ed.estate_document_id,
        
        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate ,
        ed.document_name,
        ed.file_url,
        ed.created_at,
        ed.created_by,
        ed.uploaded_at,
        ed.uploaded_by

      FROM estate_documents ed
      LEFT JOIN users u ON ed.created_by = u.users_id
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      WHERE ed.estate_document_id = $1
    `;

    const responseResult = await client.query(responseQuery, [
      result.rows[0].estate_document_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Estate document created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating estate document:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

/* -----------------------------
   ESTATE DOCUMENTS
------------------------------ */

exports.getEstateDocuments = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { estate_id, page = 1, limit = 10 } = req.query;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum =
      parseInt(limit) > 0 && parseInt(limit) <= 100 ? parseInt(limit) : 10;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Add estate filter if provided
    if (estate_id) {
      conditions.push(`ed.estate_id = $${paramIndex++}`);
      values.push(estate_id);
    }

    // Add company/builder scope
    conditions.push(
      `(e.company_id = $${paramIndex++} OR e.builder_id = $${paramIndex++})`,
    );
    values.push(companyId, builderId);

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM estate_documents ed
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      ${whereClause}
    `;

    const countResult = await client.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].total_count);

    // Get paginated results
    const dataQuery = `
      SELECT 
        ed.estate_document_id,
        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate,
        ed.document_name,
        ed.file_url,
        ed.created_at,
        ed.created_by,
        ed.uploaded_at,
        ed.uploaded_by

      FROM estate_documents ed
      LEFT JOIN users u ON ed.created_by = u.users_id
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      ${whereClause}
      ORDER BY ed.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limitNum, offset);
    const result = await client.query(dataQuery, values);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);

    return successResponse(
      res,
      {
        data: keysToCamelCase(result.rows),
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalRecords: totalCount,
          limit: limitNum,
        },
      },
      "Estate documents fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching estate documents:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateEstateDocument = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { document_name } = req.body;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    // const fileUrl = req.body.file_url;

    const fileUrl =
      (req.body.fileUrl === "" ? null : req.body.fileUrl) ||
      (req.body.file_url === "" ? null : req.body.file_url);

    const checkQuery = `
      SELECT ed.*
      FROM estate_documents ed
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      WHERE ed.estate_document_id = $1 
        AND (e.company_id = $2 OR e.builder_id = $3)
    `;
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Estate document not found or access denied",
      );
    }

    const existingDocument = checkResult.rows[0];

    if (fileUrl !== undefined) {
      if (!fileUrl) {
        if (existingDocument.file_url) {
          await deleteFromS3(existingDocument.file_url);
        }
      } else {
        if (
          existingDocument.file_url &&
          existingDocument.file_url !== fileUrl
        ) {
          await deleteFromS3(existingDocument.file_url);
        }
      }
    }

    const updateQuery = `
      UPDATE estate_documents 
      SET document_name = $1, file_url = $2, uploaded_by = $3, uploaded_at = NOW()
      WHERE estate_document_id = $4
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      document_name,
      fileUrl !== undefined ? fileUrl : existingDocument.file_url,
      userId,
      id,
    ]);

    const responseQuery = `
      SELECT 
        ed.estate_document_id,
        
        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate,
        ed.document_name,
        ed.file_url,
        ed.created_at,
        ed.created_by,
        ed.uploaded_at,
        ed.uploaded_by

      FROM estate_documents ed
      LEFT JOIN users u ON ed.created_by = u.users_id
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      WHERE ed.estate_document_id = $1
    `;

    const responseResult = await client.query(responseQuery, [id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Estate document updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating estate document:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
