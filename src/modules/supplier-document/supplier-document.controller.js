import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

export async function createSupplierDocument(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { supplier_id, induction_pack_received } = req.body || {};

    const work_cover_url =
      req.files?.workCoverImage?.[0]?.location ||
      req.body.work_cover_image ||
      null;
    const pl_insurance_url =
      req.files?.plInsuranceImage?.[0]?.location ||
      req.body.pl_insurance_image ||
      null;
    const white_card_url =
      req.files?.whiteCardImage?.[0]?.location ||
      req.body.white_card_image ||
      null;
    const fork_lift_license_url =
      req.files?.forkLiftLicenseImage?.[0]?.location ||
      req.body.fork_lift_license_image ||
      null;
    const trade_license_url =
      req.files?.tradeLicenseImage?.[0]?.location ||
      req.body.trade_license_image ||
      null;
    const induction_pack_url =
      req.files?.inductionPackImage?.[0]?.location ||
      req.body.induction_pack_image ||
      null;

    if (!supplier_id) {
      return errorResponse(res, 400, "supplier_id is required.");
    }

    const checkSupplierQuery = `
      SELECT supplier_id, builder_id 
      FROM supplier 
      WHERE supplier_id = $1;
    `;

    const supplierResult = await client.query(checkSupplierQuery, [
      supplier_id,
    ]);

    if (
      supplierResult.rowCount === 0 ||
      supplierResult.rows[0].builder_id !== builderId
    ) {
      return errorResponse(
        res,
        403,
        "Supplier does not belong to this builder.",
      );
    }

    if (supplier_id) {
      const supplierCheck = await client.query(
        `SELECT supplier_id 
     FROM supplier 
     WHERE builder_id = $1 
       AND supplier_id = $2 
       AND status = true`,
        [builderId, supplier_id],
      );

      if (supplierCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "supplier id is inactive.");
      }
    }

    // const checkExistingDocQuery = `
    //   SELECT supplier_document_id
    //   FROM supplier_documents
    //   WHERE supplier_id = $1
    //   LIMIT 1;
    // `;

    // const existingDoc = await client.query(checkExistingDocQuery, [
    //   supplier_id,
    // ]);

    // if (existingDoc.rowCount > 0) {
    //   return errorResponse(
    //     res,
    //     409,
    //     "Supplier documents already created for this supplier."
    //   );
    // }

    const inductionBoolean =
      induction_pack_received === true || induction_pack_received === "true";

    if (inductionBoolean) {
      if (!induction_pack_url) {
        return errorResponse(
          res,
          400,
          "induction_pack_url is required when induction_pack_received is true.",
        );
      }
    }

    if (!inductionBoolean) {
      if (induction_pack_url) {
        return errorResponse(
          res,
          400,
          "You cannot provide induction_pack_url when induction_pack_received is false.",
        );
      }
    }

    const insertQuery = `
      INSERT INTO supplier_documents (
        supplier_id,
        work_cover_url,
        pl_insurance_url,
        white_card_url,
        fork_lift_license_url,
        trade_license_url,
        induction_pack_received,
        induction_pack_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const insertValues = [
      supplier_id,
      work_cover_url,
      pl_insurance_url,
      white_card_url,
      fork_lift_license_url,
      trade_license_url,
      inductionBoolean,
      induction_pack_url,
    ];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Supplier documents created successfully.",
    );
  } catch (error) {
    console.error("Create Supplier Document Error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function getAllSupplierDocuments(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { page = 1, limit = 25 } = req.query;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT sd.*
      FROM supplier_documents sd
      INNER JOIN supplier s ON sd.supplier_id = s.supplier_id
      WHERE s.builder_id = $1
      ORDER BY sd.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM supplier_documents sd
      INNER JOIN supplier s ON sd.supplier_id = s.supplier_id
      WHERE s.builder_id = $1;
    `;

    const countResult = await client.query(countQuery, [builderId]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        supplierDocuments: keysToCamelCase(dataResult.rows),

        currentPage: pageValue,
        totalPages,
        totalRecords,
        limit: limitValue,
      },
      "Supplier documents fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Supplier Documents Error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function updateSupplierDocument(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    const { induction_pack_received } = req.body || {};

    const work_cover_url =
      req.files?.workCoverImage?.[0]?.location || req.body.work_cover_image;
    const pl_insurance_url =
      req.files?.plInsuranceImage?.[0]?.location || req.body.pl_insurance_image;
    const white_card_url =
      req.files?.whiteCardImage?.[0]?.location || req.body.white_card_image;
    const fork_lift_license_url =
      req.files?.forkLiftLicenseImage?.[0]?.location ||
      req.body.fork_lift_license_image;
    const trade_license_url =
      req.files?.tradeLicenseImage?.[0]?.location ||
      req.body.trade_license_image;
    const induction_pack_url =
      req.files?.inductionPackImage?.[0]?.location ||
      req.body.induction_pack_image;

    const supplierDocCheck = await client.query(
      `
      SELECT sd.*, s.builder_id
      FROM supplier_documents sd
      INNER JOIN supplier s ON sd.supplier_id = s.supplier_id
      WHERE sd.supplier_document_id = $1
      `,
      [id],
    );

    if (
      supplierDocCheck.rowCount === 0 ||
      supplierDocCheck.rows[0].builder_id !== builderId
    ) {
      return errorResponse(
        res,
        403,
        "Supplier document does not belong to this builder.",
      );
    }

    const inductionBoolean =
      induction_pack_received === true ||
      induction_pack_received === "true" ||
      induction_pack_received === 1 ||
      induction_pack_received === "1";

    if (!inductionBoolean && induction_pack_url) {
      return errorResponse(
        res,
        400,
        "You cannot provide induction_pack_url when induction_pack_received is false.",
      );
    }

    if (inductionBoolean && !induction_pack_url) {
      return errorResponse(
        res,
        400,
        "induction_pack_url is required when induction_pack_received is true.",
      );
    }

    const oldData = supplierDocCheck.rows[0];

    let updateQuery = "UPDATE supplier_documents SET ";
    const updateValues = [];
    let i = 1;

    const updateImageField = async (fieldName, newValue, oldValue) => {
      if (newValue !== null) {
        if (oldValue) {
          await deleteFromS3(oldValue);
        }
        updateQuery += `${fieldName} = $${i}, `;
        updateValues.push(newValue);
        i++;
      }
    };

    await updateImageField(
      "work_cover_url",
      work_cover_url,
      oldData.work_cover_url,
    );
    await updateImageField(
      "pl_insurance_url",
      pl_insurance_url,
      oldData.pl_insurance_url,
    );
    await updateImageField(
      "white_card_url",
      white_card_url,
      oldData.white_card_url,
    );
    await updateImageField(
      "fork_lift_license_url",
      fork_lift_license_url,
      oldData.fork_lift_license_url,
    );
    await updateImageField(
      "trade_license_url",
      trade_license_url,
      oldData.trade_license_url,
    );
    await updateImageField(
      "induction_pack_url",
      induction_pack_url,
      oldData.induction_pack_url,
    );

    updateQuery += `induction_pack_received = $${i} `;
    updateValues.push(inductionBoolean);
    i++;

    updateQuery += `WHERE supplier_document_id = $${i} RETURNING *;`;
    updateValues.push(id);

    const updateResult = await client.query(updateQuery, updateValues);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Supplier documents updated successfully.",
    );
  } catch (error) {
    console.error("Update Supplier Document Error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error.");
  } finally {
    client.release();
  }
}
