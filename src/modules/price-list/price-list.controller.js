import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import {
  deletePriceListService,
} from "./price-list.service.js";

export async function createPriceList(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const { name, sort_order = 0, show_in_view_list = true, location } = req.body;

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Name is required.");
    }

    await client.query("BEGIN");

    const nameExists = await client.query(
      `SELECT 1 
       FROM price_list 
       WHERE name = $1 AND company_id = $2 AND builder_id = $3`,
      [name.trim(), companyId, builderId],
    );

    if (nameExists.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Name already exists.");
    }

    let finalSortOrder = sort_order;

    if (finalSortOrder === undefined || finalSortOrder === null) {
      finalSortOrder = 1;
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM price_list
      WHERE company_id = $1 AND builder_id = $2;
    `;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      companyId,
      builderId,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    const shiftSortOrderQuery = `
      UPDATE price_list
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND company_id = $2
        AND builder_id = $3;
    `;

    await client.query(shiftSortOrderQuery, [
      finalSortOrder,
      companyId,
      builderId,
    ]);

    if (location) {
      const locationCheck = await client.query(
        "SELECT 1 FROM location WHERE location_id = $1 AND status = true",
        [location],
      );

      if (locationCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid location. Location does not exist.",
        );
      }
    }

    const insertQuery = `
      INSERT INTO price_list (
        company_id,
        builder_id,
        name,
        sort_order,
        show_in_view_list,
        location,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      sort_order,
      show_in_view_list,
      location,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllPriceList(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user?.users_id;

    let { page = 1, limit = 25, is_active, is_suggested, search, location_id } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const offset = (page - 1) * limit;

    const existingQuery = `
      SELECT price_list_id
      FROM price_list
      WHERE company_id = $1 AND builder_id = $2
      LIMIT 1
    `;
    const existingResult = await client.query(existingQuery, [
      companyId,
      builderId,
    ]);

    if (existingResult.rowCount === 0) {
      const defaultPriceLists = [
        {
          name: "Standard Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Premium Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Deluxe Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Basic Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Custom Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Economy Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Luxury Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Executive Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Family Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
        {
          name: "Business Package",
          show_in_view_list: true,
          is_active: true,
          is_suggested: true,
        },
      ];

      const insertQuery = `
        INSERT INTO price_list (
          company_id,
          builder_id,
          name,
          sort_order,
          show_in_view_list,
          is_active,
          is_suggested,
          created_by,
          updated_by
        ) VALUES
        ${defaultPriceLists
          .map(
            (_, i) =>
              `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4},
                $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`,
          )
          .join(", ")}
        RETURNING *;
      `;

      const insertValues = [];
      defaultPriceLists.forEach((priceList) => {
        insertValues.push(
          companyId,
          builderId,
          priceList.name,
          priceList.sort_order,
          priceList.show_in_view_list,
          priceList.is_active,
          priceList.is_suggested,
          userId,
          userId,
        );
      });

      await client.query(insertQuery, insertValues);

      if (!is_active && !is_suggested && !search && !location_id) {
        return successResponse(
          res,
          {
            priceList: [],
            pagination: {
              totalRecords: 0,
              currentPage: page,
              limit,
              totalPages: 0,
            },
          },
          "Price list fetched successfully.",
        );
      }
    }

    const conditions = ["company_id = $1", "builder_id = $2"];
    const values = [companyId, builderId];
    let index = 3;

    if (is_suggested !== undefined) {
      conditions.push(`is_suggested = $${index}`);
      values.push(is_suggested === "true");
      index++;
    } else {
      conditions.push("is_suggested = false");
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${index}`);
      values.push(is_active === "true");
      index++;
    }

    if (search) {
      conditions.push(`name ILIKE $${index}`);
      values.push(`%${search.trim()}%`);
      index++;
    }
    if (location_id) {
      conditions.push(`location = $${index}`);
      values.push(location_id);
      index++;
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const listQuery = `
      SELECT *
      FROM price_list
      ${whereClause}
      ORDER BY sort_order ASC, name ASC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM price_list
      ${whereClause};
    `;

    const [listResult, countResult] = await Promise.all([
      client.query(listQuery, values),
      client.query(countQuery, values),
    ]);

    const rows = keysToCamelCase(listResult.rows);
    const total = parseInt(countResult.rows[0].total, 10);

    const pagination = {
      totalRecords: total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return successResponse(
      res,
      { priceList: rows, pagination },
      "Price list fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deletePriceList(req, res) {
  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { priceListId } = req.params;

    if (!priceListId) {
      return errorResponse(res, 400, "priceListId is required.");
    }

    await deletePriceListService(priceListId, companyId, builderId);

    return successResponse(res, null, "Price list deleted successfully.");
  } catch (error) {
    console.error("Error deleting price list:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

// export async function deletePriceList(req, res) {
//   const pool = getPool();
//   const client = await pool.connect();

//   try {
//     const builderId = req.user.builder_id;
//     const companyId = req.user.company_id;
//     const { priceListId } = req.params;

//     if (!priceListId) {
//       return errorResponse(res, 400, "priceListId is required.");
//     }

//     await client.query("BEGIN");

//     const existing = await client.query(
//       `
//       SELECT price_list_id 
//       FROM price_list 
//       WHERE price_list_id = $1 
//         AND company_id = $2 
//         AND builder_id = $3
//         AND is_system_data = false
//       `,
//       [priceListId, companyId, builderId],
//     );

//     if (existing.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return errorResponse(
//         res,
//         404,
//         "Record not found or you do not have permission to delete this.",
//       );
//     }

//     const sortOrderQuery = await client.query(
//       `SELECT sort_order 
//        FROM price_list 
//        WHERE price_list_id = $1 
//          AND company_id = $2 
//          AND builder_id = $3`,
//       [priceListId, companyId, builderId],
//     );

//     if (sortOrderQuery.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return errorResponse(
//         res,
//         404,
//         "Record not found or you do not have permission to delete this.",
//       );
//     }

//     const deletedSortOrder = sortOrderQuery.rows[0].sort_order;

//     const shiftQuery = `
//       UPDATE price_list
//       SET sort_order = sort_order - 1
//       WHERE sort_order > $1
//         AND company_id = $2
//         AND builder_id = $3
//     `;

//     await client.query(shiftQuery, [deletedSortOrder, companyId, builderId]);

//     await client.query(
//       "DELETE FROM price_list WHERE price_list_id = $1 AND builder_id = $2",
//       [priceListId, builderId],
//     );

//     await client.query("COMMIT");

//     return successResponse(res, null, "Price list deleted successfully.");
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error deleting price list:", error);
//     return errorResponse(res, 500, error?.message || "Internal Server Error");
//   } finally {
//     client.release();
//   }
// }

export async function updatePriceList(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const { priceListId } = req.params;

    if (!priceListId) {
      return errorResponse(res, 400, "priceListId is required.");
    }

    const { name, sort_order, show_in_view_list, is_active, location } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT *
      FROM price_list
      WHERE price_list_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [priceListId, companyId, builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Record not found or you do not have permission to update this.",
      );
    }

    const current = existing.rows[0];
    const currentIsActive = current.is_active;

    // const updatingOtherFields = [
    //   req.body.name,
    //   req.body.sort_order,
    //   req.body.show_in_view_list,
    // ].some((val) => val !== undefined);

    // const requestedIsActiveTrue = is_active === true || is_active === "true";
    // const requestedIsActiveFalse = is_active === false || is_active === "false";

    // if (currentIsActive === true && is_active !== undefined) {
    //   if (requestedIsActiveFalse) {
    //     if (updatingOtherFields) {
    //       await client.query("ROLLBACK");
    //       return errorResponse(
    //         res,
    //         403,
    //         "To deactivate an active price list, 'is_active' must be the only field provided in the request.",
    //       );
    //     }
    //   }
    // }

    // if (currentIsActive === false) {
    //   const performingActivation = is_active === true || is_active === "true";

    //   if (is_active !== undefined) {
    //     if (is_active === false || is_active === "false") {
    //       await client.query("ROLLBACK");
    //       return errorResponse(
    //         res,
    //         403,
    //         "Price list is already inactive. 'is_active' can only be updated to true from this state.",
    //       );
    //     }
    //   }

    //   if (updatingOtherFields && !performingActivation) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "Cannot update non-'is_active' fields when price list is currently inactive. Only 'is_active' can be changed (to true).",
    //     );
    // }

    //   if (performingActivation && updatingOtherFields) {
    //   }
    // }

    if (name && name.trim() !== current.name) {
      const nameCheck = await client.query(
        `
        SELECT 1 
        FROM price_list 
        WHERE name = $1 
          AND company_id = $2 
          AND builder_id = $3
          AND price_list_id <> $4
        `,
        [name.trim(), companyId, builderId, priceListId],
      );

      if (nameCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Name already exists.");
      }
    }

    if (sort_order !== undefined) {
      const newSort = parseInt(sort_order, 10);

      const maxSortQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM price_list
    WHERE company_id = $1
      AND builder_id = $2
  `;

      const maxSortResult = await client.query(maxSortQuery, [
        companyId,
        builderId,
      ]);
      const maxSortOrder = maxSortResult.rows[0].max_sort_order;

      if (newSort < 1 || newSort > maxSortOrder) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (newSort !== current.sort_order) {
        if (newSort > current.sort_order) {
          await client.query(
            `
        UPDATE price_list
        SET sort_order = sort_order - 1
        WHERE sort_order > $1
          AND sort_order <= $2
          AND company_id = $3
          AND builder_id = $4
          AND price_list_id != $5
        `,
            [current.sort_order, newSort, companyId, builderId, priceListId],
          );
        } else {
          await client.query(
            `
        UPDATE price_list
        SET sort_order = sort_order + 1
        WHERE sort_order >= $1
          AND sort_order < $2
          AND company_id = $3
          AND builder_id = $4
          AND price_list_id != $5
        `,
            [newSort, current.sort_order, companyId, builderId, priceListId],
          );
        }
      }
    }

    if (location) {
      const locationCheck = await client.query(
        `SELECT 1 FROM location WHERE location_id = $1 AND status = true`,
        [location],
      );

      if (locationCheck.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid location. Location does not exist.",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let idx = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${idx++}`);
      updateValues.push(name.trim());
    }
    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${idx++}`);
      updateValues.push(sort_order);
    }
    if (show_in_view_list !== undefined) {
      updateFields.push(`show_in_view_list = $${idx++}`);
      updateValues.push(show_in_view_list);
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${idx++}`);
      updateValues.push(is_active);
    }
    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    updateFields.push(`updated_by = $${idx++}`);
    updateValues.push(userId);

    updateFields.push("updated_at = NOW()");

    updateValues.push(priceListId);

    const updateQuery = `
      UPDATE price_list
      SET ${updateFields.join(", ")}
      WHERE price_list_id = $${idx}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Price list updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function toggleSuggestedPriceList(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { priceListId } = req.params;

    if (!priceListId) {
      return errorResponse(res, 400, "priceListId is required.");
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT price_list_id, is_suggested
      FROM price_list
      WHERE price_list_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [priceListId, companyId, builderId],
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Price list not found or you do not have permission to modify this.",
      );
    }

    const currentPriceList = existing.rows[0];

    if (currentPriceList.is_suggested === false) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Cannot change is_suggested from false to true. Only allowed to change from true to false.",
      );
    }

    const cleanupDuplicatesQuery = `
      WITH numbered_records AS (
        SELECT 
          price_list_id,
          ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, 999999), created_at) as new_order
        FROM price_list
        WHERE company_id = $1
          AND builder_id = $2
      )
      UPDATE price_list p
      SET sort_order = nr.new_order,
          updated_at = NOW()
      FROM numbered_records nr
      WHERE p.price_list_id = nr.price_list_id
        AND p.sort_order != nr.new_order
    `;
    await client.query(cleanupDuplicatesQuery, [companyId, builderId]);

    const getCurrentSortOrderQuery = `
      SELECT sort_order as current_sort_order
      FROM price_list
      WHERE price_list_id = $1
    `;
    const sortOrderResult = await client.query(getCurrentSortOrderQuery, [
      priceListId,
    ]);
    const currentSortOrder = sortOrderResult.rows[0].current_sort_order;

    if (currentSortOrder === null) {
      const maxSortQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM price_list
        WHERE company_id = $1
          AND builder_id = $2
      `;
      const maxSortResult = await client.query(maxSortQuery, [
        companyId,
        builderId,
      ]);
      const newSortOrder = maxSortResult.rows[0].max_sort_order + 1;

      await client.query(
        "UPDATE price_list SET sort_order = $1, updated_at = NOW() WHERE price_list_id = $2",
        [newSortOrder, priceListId],
      );
    } else {
      const shiftQuery = `
        UPDATE price_list
        SET sort_order = sort_order - 1,
            updated_at = NOW()
        WHERE company_id = $1
          AND builder_id = $2
          AND price_list_id != $3
          AND sort_order > $4
      `;
      await client.query(shiftQuery, [
        companyId,
        builderId,
        priceListId,
        currentSortOrder,
      ]);
    }

    const updateQuery = `
      UPDATE price_list
      SET is_suggested = false,
          updated_by = $1,
          updated_at = NOW()
      WHERE price_list_id = $2
        AND company_id = $3
        AND builder_id = $4
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, [
      req.user?.users_id,
      priceListId,
      companyId,
      builderId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Price list is_suggested status updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error toggling is_suggested price list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
