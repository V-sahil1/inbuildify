import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

export async function createMasterFacade(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const imageUrl = req.file?.location || null;

    const {
      name,
      location_id,
      dwelling_type_id,
      range_id,
      cost_type = "standard",
      cost,
      builder_cost,
      status = true,
    } = req.body || {};

    if (!["standard", "upgrade"].includes(cost_type)) {
      return errorResponse(res, 400, "Invalid cost_type.");
    }

    if (location_id) {
      const locCheck = await client.query(
        `SELECT location_id
         FROM location
         WHERE location_id = $1 AND builder_id = $2`,
        [location_id, builderId],
      );

      if (locCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid location id does not belong to this builder.",
        );
      }
    }

    if (location_id) {
      const locActiveCheck = await client.query(
        `SELECT location_id
         FROM location
         WHERE location_id = $1 AND builder_id = $2 AND status = true`,
        [location_id, builderId],
      );

      if (locActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive location.");
      }
    }

    if (range_id) {
      const rangeCheck = `
        SELECT range_id
        FROM range
        WHERE range_id = $1
          AND builder_id = $2
          AND is_active = true
      `;
      const rangeResult = await client.query(rangeCheck, [range_id, builderId]);
      if (rangeResult.rowCount === 0) {
        return errorResponse(res, 404, "Invalid or inactive range.");
      }
    }

    if (dwelling_type_id) {
      const dwellingCheck = `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = $1
          AND builder_id = $2
          AND is_active = true
      `;
      const dwellingResult = await client.query(dwellingCheck, [
        dwelling_type_id,
        builderId,
      ]);
      if (dwellingResult.rowCount === 0) {
        return errorResponse(res, 404, "Invalid or inactive dwelling type.");
      }
    }

    const uniqueCheck = `
      SELECT facade_id
      FROM facade
      WHERE location_id = $1
        AND name = $2
    `;
    const uniqueResult = await client.query(uniqueCheck, [location_id, name]);
    if (uniqueResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "Facade with this name already exists for this location.",
      );
    }

    const insertQuery = `
      INSERT INTO facade (
        company_id,
        builder_id,
        location_id,
        name,
        dwelling_type_id,
        range_id,
        cost_type,
        cost,
        builder_cost,
        image,
        status,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12
      )
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      location_id,
      name,
      dwelling_type_id || null,
      range_id || null,
      cost_type,
      cost || null,
      builder_cost || null,
      imageUrl,
      status,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    // Fetch complete facade data with related objects using json_build_object
    const completeResult = await client.query(
      `
      SELECT
        f.facade_id,
        f.name,
        f.cost_type,
        f.cost,
        f.builder_cost,
        f.image,
        f.status,
        json_build_object(
          'id', f.location_id,
          'name', l.name
        ) AS location,
        json_build_object(
          'id', f.dwelling_type_id,
          'name', dt.name
        ) AS dwellingType,
        json_build_object(
          'id', f.range_id,
          'name', r.name
        ) AS range
      FROM facade f
      LEFT JOIN location l ON f.location_id = l.location_id
      LEFT JOIN dwelling_type dt ON f.dwelling_type_id = dt.dwelling_type_id
      LEFT JOIN range r ON f.range_id = r.range_id
      WHERE f.facade_id = $1
      `,
      [result.rows[0].facade_id],
    );

    const facadeData = completeResult.rows[0];
    const transformedResponse = keysToCamelCase(facadeData);

    return successResponse(
      res,
      transformedResponse,
      "Facade created successfully.",
    );
  } catch (error) {
    console.error("Create Facade Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Facade with this name already exists.");
    }

    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
}

export async function getMasterFacades(req, res) {
  const builderId = req.user.builder_id;
  const companyId = req.user.company_id;

  const {
    name,
    dwelling_type_id,
    range_id,
    cost_type,
    location_id,
    status,
    search,
    page = 1,
    limit = 25,
  } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let baseQuery = `
      SELECT
        f.facade_id,
        f.name,
        f.cost_type,
        f.cost,
        f.builder_cost,
        f.image,
        f.status,
    
        json_build_object(
          'id', f.location_id,
          'name', l.name
        ) AS location,
        json_build_object(
          'id', f.dwelling_type_id,
          'name', dt.name
        ) AS dwellingType,
        json_build_object(
          'id', f.range_id,
          'name', r.name
        ) AS range
      FROM facade f
      LEFT JOIN dwelling_type dt 
        ON f.dwelling_type_id = dt.dwelling_type_id
      LEFT JOIN range r 
        ON f.range_id = r.range_id
      LEFT JOIN location l
        ON f.location_id = l.location_id
      WHERE f.builder_id = $1
        AND f.company_id = $2
    `;

    const queryParams = [builderId, companyId];
    let paramIndex = 3;

    if (name) {
      baseQuery += ` AND f.name ILIKE $${paramIndex}`;
      queryParams.push(`%${name}%`);
      paramIndex++;
    }
    if (search) {
      baseQuery += ` AND (f.name ILIKE $${paramIndex} OR f.cost::TEXT ILIKE $${paramIndex})`;
      queryParams.push(`%${search.trim().toLowerCase()}%`);
      paramIndex++;
    }
    if (location_id) {
      baseQuery += ` AND f.location_id = $${paramIndex}`;
      queryParams.push(location_id);
      paramIndex++;
    }

    if (dwelling_type_id) {
      baseQuery += ` AND f.dwelling_type_id = $${paramIndex}`;
      queryParams.push(dwelling_type_id);
      paramIndex++;
    }

    if (range_id) {
      baseQuery += ` AND f.range_id = $${paramIndex}`;
      queryParams.push(range_id);
      paramIndex++;
    }

    if (cost_type) {
      baseQuery += ` AND f.cost_type = $${paramIndex}`;
      queryParams.push(cost_type);
      paramIndex++;
    }

    if (status !== undefined) {
      baseQuery += ` AND f.status = $${paramIndex}`;
      queryParams.push(status === "true");
      paramIndex++;
    }

    baseQuery += `
      ORDER BY f.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limitValue, offset);

    const result = await client.query(baseQuery, queryParams);

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM facade f
      WHERE f.builder_id = $1
        AND f.company_id = $2
    `;

    const countParams = [builderId, companyId];
    let countIndex = 3;

    if (name) {
      countQuery += ` AND f.name ILIKE $${countIndex}`;
      countParams.push(`%${name}%`);
      countIndex++;
    }
    if (search) {
      countQuery += ` AND (f.name ILIKE $${countIndex} OR f.cost::TEXT ILIKE $${countIndex})`;
      countParams.push(`%${search.trim().toLowerCase()}%`);
      countIndex++;
    }

    if (search) {
      countQuery += ` AND (f.name ILIKE $${countIndex} OR f.cost::TEXT ILIKE $${countIndex})`;
      countParams.push(`%${search.trim().toLowerCase()}%`);
      countIndex++;
    }

    if (location_id) {
      countQuery += ` AND f.location_id = $${countIndex}`;
      countParams.push(location_id);
      countIndex++;
    }

    if (dwelling_type_id) {
      countQuery += ` AND f.dwelling_type_id = $${countIndex}`;
      countParams.push(dwelling_type_id);
      countIndex++;
    }

    if (range_id) {
      countQuery += ` AND f.range_id = $${countIndex}`;
      countParams.push(range_id);
      countIndex++;
    }

    if (cost_type) {
      countQuery += ` AND f.cost_type = $${countIndex}`;
      countParams.push(cost_type);
      countIndex++;
    }

    if (status !== undefined) {
      countQuery += ` AND f.status = $${countIndex}`;
      countParams.push(status === "true");
      countIndex++;
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return successResponse(
      res,
      {
        facades: keysToCamelCase(result.rows),
        pagination: {
          currentPage: pageValue,
          totalPages: Math.ceil(total / limitValue),
          totalRecords: total,
          limit: limitValue,
        },
      },
      "Facades fetched successfully.",
    );
  } catch (error) {
    console.error("Get Facades error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getMasterFacadeById(req, res) {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        f.facade_id,
        f.name,
        f.cost_type,
        f.cost,
        f.builder_cost,
        f.image,
        f.status,
       
        json_build_object(
          'id', f.location_id,
          'name', l.name
        ) AS location,
        json_build_object(
          'id', f.dwelling_type_id,
          'name', dt.name
        ) AS dwellingType,
        json_build_object(
          'id', f.range_id,
          'name', r.name
        ) AS range
      FROM facade f
      LEFT JOIN location l ON f.location_id = l.location_id
      LEFT JOIN dwelling_type dt ON f.dwelling_type_id = dt.dwelling_type_id
      LEFT JOIN range r ON f.range_id = r.range_id
      WHERE f.facade_id = $1 AND f.builder_id = $2;
    `;
    const result = await client.query(query, [id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, " Facade not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      " Facade fetched successfully.",
    );
  } catch (error) {
    console.error("Get facade by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateMasterFacade(req, res) {
  const { facade_id } = req.params;
  const builderId = req.user.builder_id;
  const companyId = req.user.company_id;
  const userId = req.user.user_id;
  const updates = req.body;
  const imageUrl = req.file?.location;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkQuery = `
      SELECT *
      FROM facade
      WHERE facade_id = $1
        AND builder_id = $2
        AND company_id = $3 FOR UPDATE;
    `;
    const checkResult = await client.query(checkQuery, [
      facade_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Facade not found.");
    }

    const existingFacade = checkResult.rows[0];
    const currentStatus = existingFacade.status;
    const statusInBody =
      updates &&
      typeof updates === "object" &&
      Object.prototype.hasOwnProperty.call(updates, "status");

    let requestedStatus = statusInBody ? updates.status : undefined;

    const updatesWithoutStatus = { ...updates };
    delete updatesWithoutStatus.status;

    const updatingOtherFields =
      Object.keys(updatesWithoutStatus).length > 0 || !!imageUrl;

    if (statusInBody) {
      if (typeof requestedStatus === "string") {
        const v = requestedStatus.trim().toLowerCase();
        if (v === "true") {
          requestedStatus = true;
        } else if (v === "false") {
          requestedStatus = false;
        } else {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "The 'status' field must be a boolean (true or false).",
          );
        }
      } else if (typeof requestedStatus !== "boolean") {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "The 'status' field must be a boolean (true or false).",
        );
      }
    }

    // if (currentStatus === false) {
    //   const performingActivation = statusInBody && requestedStatus === true;

    //   if (statusInBody && requestedStatus === false) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "Facade is already Inactive. 'status' can only be updated to true (Active) from this state.",
    //     );
    //   }

    //   if (updatingOtherFields && !performingActivation) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "Cannot update non-'status' fields when the facade is currently Inactive. Only 'status' can be changed (to true/Active).",
    //     );
    //   }

    //   if (performingActivation && updatingOtherFields) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "To activate an inactive facade, 'status' must be the only field provided in the request.",
    //     );
    //   }
    // }

    // if (currentStatus === true && statusInBody && requestedStatus === false) {
    //   if (updatingOtherFields) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "To deactivate an active facade, 'status' must be the only field provided in the request.",
    //     );
    //   }
    // }

    if (statusInBody) {
      updates.status = requestedStatus;
    }

    const setClauses = [];
    const values = [];

    const allowedFields = [
      "name",
      "cost_type",
      "cost",
      "builder_cost",
      "status",
      "location_id",
    ];

    for (const [key, rawValue] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        continue;
      }

      const value = rawValue;

      setClauses.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }

    if (updates.cost_type) {
      if (!["standard", "upgrade"].includes(updates.cost_type)) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid cost_type.");
      }
    }

    if (updates.location_id) {
      const locCheck = `
        SELECT location_id
        FROM location
        WHERE location_id = $1
          AND builder_id = $2
      `;
      const locResult = await client.query(locCheck, [
        updates.location_id,
        builderId,
      ]);
      if (locResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Invalid location.");
      }
    }

    if (updates.dwelling_type_id) {
      const dtCheck = `
        SELECT dwelling_type_id
        FROM dwelling_type
        WHERE dwelling_type_id = $1
          AND builder_id = $2
          AND is_active = true
      `;
      const dtResult = await client.query(dtCheck, [
        updates.dwelling_type_id,
        builderId,
      ]);
      if (dtResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Invalid or inactive dwelling type.");
      }

      setClauses.push(`dwelling_type_id = $${values.length + 1}`);
      values.push(updates.dwelling_type_id);
    }

    if (updates.range_id) {
      const rangeCheck = `
        SELECT range_id
        FROM range
        WHERE range_id = $1
          AND builder_id = $2
          AND is_active = true
      `;
      const rangeResult = await client.query(rangeCheck, [
        updates.range_id,
        builderId,
      ]);
      if (rangeResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Invalid or inactive range.");
      }

      setClauses.push(`range_id = $${values.length + 1}`);
      values.push(updates.range_id);
    }

    if (updates.name || updates.location_id) {
      const locationId = updates.location_id || existingFacade.location_id;
      const name = updates.name || existingFacade.name;

      const uniqueCheck = `
    SELECT facade_id
    FROM facade
    WHERE location_id = $1
      AND name = $2
      AND facade_id <> $3
  `;
      const uniqueResult = await client.query(uniqueCheck, [
        locationId,
        name,
        facade_id,
      ]);

      if (uniqueResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          "Facade with this name already exists for this location.",
        );
      }
    }

    // Handle image update/removal
    if (imageUrl) {
      // New file uploaded
      if (existingFacade.image) {
        await deleteFromS3(existingFacade.image);
      }
      setClauses.push(`image = $${values.length + 1}`);
      values.push(imageUrl);
    } else if (updates.image === null || updates.image === "") {
      // Explicitly requested removal of existing image
      if (existingFacade.image) {
        await deleteFromS3(existingFacade.image);
      }
      setClauses.push(`image = $${values.length + 1}`);
      values.push(null);
    }

    if (setClauses.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No updatable fields provided.");
    }

    const updateQuery = `
      UPDATE facade
      SET ${setClauses.join(", ")},
          updated_by = $${values.length + 1},
          updated_at = NOW()
      WHERE facade_id = $${values.length + 2}
        AND builder_id = $${values.length + 3}
        AND company_id = $${values.length + 4}
      RETURNING *;
    `;

    values.push(userId, facade_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    const completeResult = await client.query(
      `
      SELECT
        f.facade_id,
        f.name,
        f.cost_type,
        f.cost,
        f.builder_cost,
        f.image,
        f.status,
       
        json_build_object(
          'id', f.location_id,
          'name', l.name
        ) AS location,
        json_build_object(
          'id', f.dwelling_type_id,
          'name', dt.name
        ) AS dwellingType,
        json_build_object(
          'id', f.range_id,
          'name', r.name
        ) AS range
      FROM facade f
      LEFT JOIN location l ON f.location_id = l.location_id
      LEFT JOIN dwelling_type dt ON f.dwelling_type_id = dt.dwelling_type_id
      LEFT JOIN range r ON f.range_id = r.range_id
      WHERE f.facade_id = $1
      `,
      [updateResult.rows[0].facade_id],
    );

    const facadeData = completeResult.rows[0];
    const transformedResponse = keysToCamelCase(facadeData);

    return successResponse(
      res,
      transformedResponse,
      "Facade updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Facade Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Facade with this name already exists.");
    }

    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteMasterFacade(req, res) {
  const { facade_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkFacadeQuery = `
      SELECT * FROM facade WHERE facade_id = $1 AND builder_id = $2;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [
      facade_id,
      builderId,
    ]);

    if (checkFacadeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, " Facade not found.");
    }

    const deleteQuery = `
      DELETE FROM facade where facade_id = $1
    `;
    const deleteResult = await client.query(deleteQuery, [facade_id]);

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Master Facade not found.");
    }

    await client.query("COMMIT");

    return successResponse(res, {}, "Master Facade deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting master facade:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}
