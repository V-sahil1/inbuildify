const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createFloorPlan = async (req, res) => {
  const {
    name,
    min_land_width,
    min_land_depth,
    dwelling_area,
    dwelling_type_id,
    beds,
    baths,
    carpark,
    living,
    range_id,
    garage_area,
    porch_area,
    alfresco_area,
    total_area,
    description,
    status,
  } = req.body || {};

  const detailed_image = req.body.detailed_image || null;
  const simple_image = req.body.simple_image || null;

  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const userId = req.user?.user_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dupCheck = await client.query(
      `SELECT floor_plan_id
       FROM floor_plan
       WHERE builder_id = $1 AND LOWER(name) = LOWER($2)`,
      [builderId, name],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Floor plan name already exists.");
    }

    if (dwelling_type_id) {
      const dtCheck = await client.query(
        `SELECT dwelling_type_id
         FROM dwelling_type
         WHERE dwelling_type_id = $1
           AND builder_id = $2`,
        [dwelling_type_id, builderId],
      );

      if (dtCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid dwelling_type_id  does not belong to this builder.",
        );
      }
    }

    if (dwelling_type_id) {
      const dtActiveCheck = await client.query(
        `SELECT dwelling_type_id
         FROM dwelling_type
         WHERE dwelling_type_id = $1
           AND builder_id = $2 AND is_active = true`,
        [dwelling_type_id, builderId],
      );

      if (dtActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive dwelling type.");
      }
    }

    if (range_id) {
      const rangeCheck = await client.query(
        `SELECT range_id
         FROM range
         WHERE range_id = $1
           AND builder_id = $2`,
        [range_id, builderId],
      );

      if (rangeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid range_id does not belong to this builder.",
        );
      }
    }

    if (range_id) {
      const rangeActiveCheck = await client.query(
        `SELECT range_id
         FROM range
         WHERE range_id = $1
           AND builder_id = $2
           AND is_active = true`,
        [range_id, builderId],
      );

      if (rangeActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive raneg.");
      }
    }

    const insertQuery = `
      INSERT INTO floor_plan (
        company_id, builder_id, name,
        min_land_width, min_land_depth, dwelling_area,
        dwelling_type_id, beds, baths, carpark, living,
        range_id,
        garage_area, porch_area, alfresco_area, total_area,
        detailed_image, simple_image, description,
        status, created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12,
        $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21, $21
      )
      RETURNING floor_plan_id, name,
        min_land_width, min_land_depth, dwelling_area,
        dwelling_type_id, beds, baths, carpark, living,
        range_id,
        garage_area, porch_area, alfresco_area, total_area,
        detailed_image, simple_image, description,
        status;
    `;

    const values = [
      companyId,
      builderId,
      name,
      min_land_width || null,
      min_land_depth || null,
      dwelling_area || null,
      dwelling_type_id || null,
      beds || 0,
      baths || 0,
      carpark || 0,
      living || 0,
      range_id || null,
      garage_area || null,
      porch_area || null,
      alfresco_area || null,
      total_area || null,
      detailed_image || null,
      simple_image || null,
      description || null,
      status || true,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    const selectWithNamesQuery = `
      SELECT 
        fp.floor_plan_id, fp.name,
        fp.min_land_width, fp.min_land_depth, fp.dwelling_area,
        fp.dwelling_type_id, fp.beds, fp.baths, fp.carpark, fp.living,
        fp.range_id,
        fp.garage_area, fp.porch_area, fp.alfresco_area, fp.total_area,
        fp.detailed_image, fp.simple_image, fp.description,
        fp.status,
        dt.name AS dwelling_type_name, 
        r.name AS range_name
      FROM floor_plan fp
      LEFT JOIN dwelling_type dt ON dt.dwelling_type_id = fp.dwelling_type_id
      LEFT JOIN range r ON r.range_id = fp.range_id
      WHERE fp.floor_plan_id = $1
    `;

    const finalResult = await client.query(selectWithNamesQuery, [
      result.rows[0].floor_plan_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(finalResult.rows[0]),
      "Floor plan created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create floor plan error:", error);
    return errorResponse(res, 500, "Failed to create floor plan.");
  } finally {
    client.release();
  }
};

exports.getFloorPlans = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    let {
      page = 1,
      limit = 25,
      name,
      dwelling_type_id,
      range_id,
      status,
    } = req.query;

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const whereClauses = [`h.builder_id = $1`];
    const values = [builderId];
    let idx = 2;

    if (name) {
      whereClauses.push(`LOWER(h.name) LIKE LOWER($${idx})`);
      values.push(`%${name}%`);
      idx++;
    }

    if (dwelling_type_id) {
      whereClauses.push(`h.dwelling_type_id = $${idx}`);
      values.push(dwelling_type_id);
      idx++;
    }

    if (range_id) {
      whereClauses.push(`h.range_id = $${idx}`);
      values.push(range_id);
      idx++;
    }

    if (status === "true" || status === "false") {
      whereClauses.push(`h.status = $${idx}`);
      values.push(status === "true");
      idx++;
    }

    const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

    const dataQuery = `
      SELECT 
        h.floor_plan_id, h.name,
        h.min_land_width, h.min_land_depth, h.dwelling_area,
        h.dwelling_type_id, h.beds, h.baths, h.carpark, h.living,
        h.range_id, h.location_id,
        h.garage_area, h.porch_area, h.alfresco_area, h.total_area,
        h.detailed_image, h.simple_image, h.description,
        h.status, 
        dt.name AS dwelling_type_name, 
        r.name AS range_name,
        l.name AS location_name
      FROM floor_plan h
      LEFT JOIN dwelling_type dt ON dt.dwelling_type_id = h.dwelling_type_id
      LEFT JOIN range r ON r.range_id = h.range_id
      LEFT JOIN location l ON l.location_id = h.location_id
      ${whereSQL}
      ORDER BY h.created_at DESC
      LIMIT ${limitValue} OFFSET ${offset}
    `;

    const dataResult = await client.query(dataQuery, values);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM floor_plan h
      ${whereSQL}
    `;

    const countResult = await client.query(countQuery, values);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        floorPlans: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Floor plans fetched successfully.",
    );
  } catch (error) {
    console.error("Error getFloorplan:", error);
    return errorResponse(res, 500, "Something went wrong.");
  } finally {
    client.release();
  }
};

exports.updateFloorPlan = async (req, res) => {
  const { floor_plan_id } = req.params;

  const body =
    typeof req.body === "object" && req.body !== null ? req.body : {};

  const {
    name,
    min_land_width,
    min_land_depth,
    dwelling_area,
    dwelling_type_id,
    beds,
    baths,
    carpark,
    living,
    range_id,
    location_id,
    garage_area,
    porch_area,
    alfresco_area,
    total_area,
    description,
    status,
  } = body;

  const detailed_image = body.detailed_image || null;
  const simple_image = body.simple_image || null;

  const builderId = req.user?.builder_id;
  const userId = req.user?.user_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM floor_plan 
       WHERE floor_plan_id = $1 AND builder_id = $2 FOR UPDATE`,
      [floor_plan_id, builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Floor plan not found.");
    }

    const oldData = existing.rows[0];

    const currentStatus = oldData.status;
    const statusInBody = status !== undefined;

    let requestedStatus = status;
    if (statusInBody) {
      if (status === "true") requestedStatus = true;
      if (status === "false") requestedStatus = false;
    }

    const fieldsToCheck = [
      "name",
      "min_land_width",
      "min_land_depth",
      "dwelling_area",
      "dwelling_type_id",
      "beds",
      "baths",
      "carpark",
      "living",
      "range_id",
      "location_id",
      "garage_area",
      "porch_area",
      "alfresco_area",
      "total_area",
      "description",
      "detailed_image",
      "simple_image",
    ];

    const updatingOtherFields = fieldsToCheck.some((field) =>
      Object.prototype.hasOwnProperty.call(body, field),
    );

    if (statusInBody && typeof requestedStatus !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "The 'status' field must be a boolean (true or false).",
      );
    }

    if (currentStatus === false) {
      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(res, 403, "Floor plan is already inactive.");
      }
    }

    if (name) {
      const dupCheck = await client.query(
        `SELECT floor_plan_id
         FROM floor_plan
         WHERE builder_id = $1 
           AND LOWER(name) = LOWER($2)
           AND floor_plan_id != $3`,
        [builderId, name, floor_plan_id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 409, "Floor plan name already exists.");
      }
    }

    if (dwelling_type_id) {
      const dtCheck = await client.query(
        `SELECT dwelling_type_id 
         FROM dwelling_type 
         WHERE dwelling_type_id = $1 AND builder_id = $2`,
        [dwelling_type_id, builderId],
      );

      if (dtCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid dwelling type id.");
      }

      const dtActive = await client.query(
        `SELECT dwelling_type_id 
         FROM dwelling_type 
         WHERE dwelling_type_id = $1 
           AND builder_id = $2 
           AND is_active = true`,
        [dwelling_type_id, builderId],
      );

      if (dtActive.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive dwelling type.");
      }
    }

    if (range_id) {
      const rangeCheck = await client.query(
        `SELECT range_id 
         FROM range
         WHERE range_id = $1 AND builder_id = $2`,
        [range_id, builderId],
      );

      if (rangeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid range_id.");
      }

      const rangeActive = await client.query(
        `SELECT range_id 
         FROM range
         WHERE range_id = $1 
           AND builder_id = $2 
           AND is_active = true`,
        [range_id, builderId],
      );

      if (rangeActive.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive range.");
      }
    }

    if (location_id) {
      const locationCheck = await client.query(
        `SELECT location_id 
         FROM location
         WHERE location_id = $1 AND builder_id = $2`,
        [location_id, builderId],
      );

      if (locationCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid location_id.");
      }

      const locationActive = await client.query(
        `SELECT location_id 
         FROM location
         WHERE location_id = $1 
           AND builder_id = $2 
           AND status = true`,
        [location_id, builderId],
      );

      if (locationActive.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive location.");
      }
    }

    if (detailed_image && oldData.detailed_image) {
      await deleteFromS3(oldData.detailed_image);
    }

    if (simple_image && oldData.simple_image) {
      await deleteFromS3(oldData.simple_image);
    }

    const finalUpdates = [];
    const updateValues = [];
    let idx = 1;

    const addUpdate = (column, value) => {
      if (value !== undefined) {
        finalUpdates.push(`${column} = $${idx}`);
        updateValues.push(value);
        idx++;
      }
    };

    addUpdate("name", name);
    addUpdate("min_land_width", min_land_width);
    addUpdate("min_land_depth", min_land_depth);
    addUpdate("dwelling_area", dwelling_area);
    addUpdate("dwelling_type_id", dwelling_type_id);
    addUpdate("beds", beds);
    addUpdate("baths", baths);
    addUpdate("carpark", carpark);
    addUpdate("living", living);
    addUpdate("range_id", range_id);
    addUpdate("location_id", location_id);
    addUpdate("garage_area", garage_area);
    addUpdate("porch_area", porch_area);
    addUpdate("alfresco_area", alfresco_area);
    addUpdate("total_area", total_area);
    addUpdate("description", description);

    if (statusInBody) addUpdate("status", requestedStatus);

    addUpdate("detailed_image", detailed_image);
    addUpdate("simple_image", simple_image);
    addUpdate("updated_by", userId);

    finalUpdates.push("updated_at = NOW()");

    if (finalUpdates.length <= 1) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields provided to update.");
    }

    updateValues.push(floor_plan_id);

    const updateQuery = `
      UPDATE floor_plan 
      SET ${finalUpdates.join(", ")}
      WHERE floor_plan_id = $${idx}
      RETURNING floor_plan_id, name,
        min_land_width, min_land_depth, dwelling_area,
        dwelling_type_id, beds, baths, carpark, living,
        range_id, location_id,
        garage_area, porch_area, alfresco_area, total_area,
        detailed_image, simple_image, description,
        status;
    `;

    const result = await client.query(updateQuery, updateValues);

    const selectWithNamesQuery = `
      SELECT 
        fp.floor_plan_id, fp.name,
        fp.min_land_width, fp.min_land_depth, fp.dwelling_area,
        fp.dwelling_type_id, fp.beds, fp.baths, fp.carpark, fp.living,
        fp.range_id, fp.location_id,
        fp.garage_area, fp.porch_area, fp.alfresco_area, fp.total_area,
        fp.detailed_image, fp.simple_image, fp.description,
        fp.status,
        dt.name AS dwelling_type_name, 
        r.name AS range_name,
        l.name AS location_name
      FROM floor_plan fp
      LEFT JOIN dwelling_type dt ON dt.dwelling_type_id = fp.dwelling_type_id
      LEFT JOIN range r ON r.range_id = fp.range_id
      LEFT JOIN location l ON l.location_id = fp.location_id
      WHERE fp.floor_plan_id = $1
    `;

    const finalResult = await client.query(selectWithNamesQuery, [
      floor_plan_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(finalResult.rows[0]),
      "Floor plan updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update floor plan error:", err);
    return errorResponse(res, 500, "Failed to update floor plan.");
  } finally {
    client.release();
  }
};

exports.deleteFloorPlan = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { floor_plan_id } = req.params;
    const builderId = req.user?.builder_id;

    if (!floor_plan_id) {
      return errorResponse(res, 400, "Floor plan ID is required.");
    }

    const checkQuery = `
      SELECT floor_plan_id 
      FROM floor_plan 
      WHERE floor_plan_id = $1 AND builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [
      floor_plan_id,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Floor plan not found or you don't have permission to delete it.",
      );
    }

    const deleteQuery = `
      DELETE FROM floor_plan 
      WHERE floor_plan_id = $1
    `;
    await client.query(deleteQuery, [floor_plan_id]);

    return successResponse(res, null, "Floor plan deleted successfully.");
  } catch (error) {
    console.error("Delete Floor Plan Error:", error);
    return errorResponse(res, 500, "Failed to delete floor plan.");
  } finally {
    client.release();
  }
};

exports.getFloorPlanFilters = async (req, res) => {
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const rangeQuery = `
      SELECT DISTINCT r.name
      FROM floor_plan fp
      JOIN range r ON fp.range_id = r.range_id
      WHERE fp.builder_id = $1 AND r.name IS NOT NULL AND fp.is_deleted = false
      ORDER BY r.name;
    `;

    const dwellingTypeQuery = `
      SELECT DISTINCT dt.name
      FROM floor_plan fp
      JOIN dwelling_type dt ON fp.dwelling_type_id = dt.dwelling_type_id
      WHERE fp.builder_id = $1 AND dt.name IS NOT NULL AND fp.is_deleted = false
      ORDER BY dt.name;
    `;

    const [rangeResult, dwellingTypeResult] = await Promise.all([
      client.query(rangeQuery, [builderId]),
      client.query(dwellingTypeQuery, [builderId]),
    ]);

    const filters = {
      ranges: rangeResult.rows.map((row) => row.name),
      dwellingTypes: dwellingTypeResult.rows.map((row) => row.name),
    };

    return successResponse(
      res,
      filters,
      "Floor plan filters fetched successfully.",
    );
  } catch (error) {
    console.error("Get floor plan filters error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
