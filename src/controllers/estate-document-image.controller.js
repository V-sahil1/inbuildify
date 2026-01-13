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

    let query = `
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
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (estate_id) {
      query += ` AND ei.estate_id = $${paramIndex++}`;
      values.push(estate_id);
    }

    if (companyId) {
      query += ` AND e.company_id = $${paramIndex++}`;
      values.push(companyId);
    }

    if (builderId) {
      query += ` AND e.builder_id = $${paramIndex++}`;
      values.push(builderId);
    }

    query += ` ORDER BY ei.uploaded_at DESC`;

    const result = await client.query(query, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Estate images fetched successfully"
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

    const imageUrl = req.body.image_url;

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

    if (imageUrl !== undefined) {
      if (!imageUrl) {
        if (existingImage.image_url) {
          await deleteFromS3(existingImage.image_url);
        }
      } else {
        if (existingImage.image_url && existingImage.image_url !== imageUrl) {
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

    const result = await client.query(updateQuery, [imageUrl, userId, id]);

    const responseQuery = `
      SELECT 
        ei.estate_image_id,
        ei.estate_id,
        ei.image_url,
        ei.uploaded_at,
        ei.uploaded_by,

        json_build_object(
          'id', u.users_id,
          'name', u.name,
          'email', u.email
        ) AS uploadedBy,

        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate

      FROM estate_images ei
      LEFT JOIN users u ON ei.uploaded_by = u.users_id
      LEFT JOIN estate e ON ei.estate_id = e.estate_id
      WHERE ei.estate_image_id = $1
    `;

    const responseResult = await client.query(responseQuery, [id]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Estate image updated successfully"
    );
  } catch (error) {
    console.error("Error updating estate image:", error);
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
    const { estate_id } = req.query;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    let query = `
      SELECT 
        ed.estate_document_id,
        ed.estate_id,
        ed.document_name,
        ed.file_url,
        ed.uploaded_at,
        ed.uploaded_by,

        json_build_object(
          'id', u.users_id,
          'name', u.name
        ) AS uploadedBy,

        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate

      FROM estate_documents ed
      LEFT JOIN users u ON ed.uploaded_by = u.users_id
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (estate_id) {
      query += ` AND ed.estate_id = $${paramIndex++}`;
      values.push(estate_id);
    }

    if (companyId) {
      query += ` AND e.company_id = $${paramIndex++}`;
      values.push(companyId);
    }

    if (builderId) {
      query += ` AND e.builder_id = $${paramIndex++}`;
      values.push(builderId);
    }

    query += ` ORDER BY ed.uploaded_at DESC`;

    const result = await client.query(query, values);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Estate documents fetched successfully"
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
    const { id } = req.params;
    const { document_name } = req.body;
    const userId = req.user?.users_id;
    const companyId = req.user?.company_id;
    const builderId = req.user?.builder_id;

    const fileUrl = req.body.file_url;

    if (!document_name) {
      return errorResponse(res, 400, "document_name is required");
    }

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
      return errorResponse(
        res,
        404,
        "Estate document not found or access denied"
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
      fileUrl,
      userId,
      id,
    ]);

    const responseQuery = `
      SELECT 
        ed.estate_document_id,
        ed.estate_id,
        ed.document_name,
        ed.file_url,
        ed.uploaded_at,
        ed.uploaded_by,

        json_build_object(
          'id', u.users_id,
          'name', u.name
        ) AS uploadedBy,

        json_build_object(
          'id', e.estate_id,
          'name', e.name
        ) AS estate

      FROM estate_documents ed
      LEFT JOIN users u ON ed.uploaded_by = u.users_id
      LEFT JOIN estate e ON ed.estate_id = e.estate_id
      WHERE ed.estate_document_id = $1
    `;

    const responseResult = await client.query(responseQuery, [id]);

    return successResponse(
      res,
      keysToCamelCase(responseResult.rows[0]),
      "Estate document updated successfully"
    );
  } catch (error) {
    console.error("Error updating estate document:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};
