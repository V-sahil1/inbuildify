import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createPackagePriceListItemMap(req, res) {
  const builderId = req.user?.builder_id;

  const { package_id, price_list_item_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!package_id || !price_list_item_id) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "package_id and price_list_item_id are required",
      );
    }

    const pkgCheck = await client.query(
      "SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2",
      [package_id, builderId],
    );

    if (pkgCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid package_id. You can use only your own packages",
      );
    }

    const pkgActiveCheck = await client.query(
      "SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2 AND status = true",
      [package_id, builderId],
    );

    if (pkgActiveCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Inactive package.");
    }

    const itemCheck = await client.query(
      "SELECT price_list_item_id FROM price_list_item WHERE price_list_item_id = $1 AND builder_id = $2",
      [price_list_item_id, builderId],
    );

    if (itemCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid price_list_item_id. You can use only your own price list items",
      );
    }

    const itemActiveCheck = await client.query(
      "SELECT price_list_item_id FROM price_list_item WHERE price_list_item_id = $1 AND builder_id = $2 AND status = 'active'",
      [price_list_item_id, builderId],
    );

    if (itemActiveCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Inactive price list item.");
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1 FROM package_pricelist_item_map
      WHERE package_id = $1 AND price_list_item_id = $2
      `,
      [package_id, price_list_item_id],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This package is already mapped with this price list item.",
      );
    }

    const insertQuery = `
      INSERT INTO package_pricelist_item_map (package_id, price_list_item_id)
      VALUES ($1, $2)
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      package_id,
      price_list_item_id,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Package price list item mapped successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating package_pricelist_item_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function getAllPackagePriceListItemMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;

    const { page = 1, limit = 25 } = req.query;
    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM package_pricelist_item_map pi
      JOIN package p ON pi.package_id = p.package_id
      JOIN price_list_item pli ON pi.price_list_item_id = pli.price_list_item_id
      WHERE p.builder_id = $1 AND pli.builder_id = $1
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT pi.*
      FROM package_pricelist_item_map pi
      JOIN package p ON pi.package_id = p.package_id
      JOIN price_list_item pli ON pi.price_list_item_id = pli.price_list_item_id
      WHERE p.builder_id = $1 AND pli.builder_id = $1
      ORDER BY pi.id DESC 
      LIMIT $2 OFFSET $3
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    return successResponse(
      res,
      {
        packagePriceListItemMap: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Package price list item mappings fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching package price list item map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function getPackagePricelistItemByPackageId(req, res) {
  const { package_id } = req.params;
  const builderId = req.user?.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const packageCheck = await client.query(
      `SELECT package_id 
       FROM package 
       WHERE package_id = $1 AND builder_id = $2`,
      [package_id, builderId],
    );

    if (packageCheck.rows.length === 0) {
      return errorResponse(
        res,
        403,
        "You cannot access labels for another builder's package",
      );
    }

    const query = `
      SELECT pi.*, 
             p.builder_id AS package_builder_id
      FROM package_pricelist_item_map pi
      JOIN package p ON pi.package_id = p.package_id
      JOIN price_list_item pli ON pi.price_list_item_id = pli.price_list_item_id
      WHERE pi.package_id = $1
    `;

    const result = await client.query(query, [package_id]);

    return successResponse(
      res,
      {
        packagePricelistItemMaps: keysToCamelCase(result.rows),
      },
      "Package price list item mappings fetched successfully",
    );
  } catch (error) {
    console.error(
      "Error fetching package price list item map by package_id:",
      error,
    );
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

export async function deletePackagePricelistItemMapMap(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { id } = req.params;

    await client.query("BEGIN");

    const checkQuery = `
      SELECT pi.id
      FROM package_pricelist_item_map pi
      JOIN package p ON pi.package_id = p.package_id
      WHERE pi.id = $1 AND p.builder_id = $2
    `;
    const checkResult = await client.query(checkQuery, [id, builderId]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You are not allowed to delete this mapping.",
      );
    }

    const deleteQuery = "DELETE FROM package_pricelist_item_map WHERE id = $1";
    await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      {},
      "package pricelist item map deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting package pricelist item map:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updatePackagePriceListItemMap(req, res) {
  const { id } = req.params;
  const builderId = req.user?.builder_id;

  const { package_id, price_list_item_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const findQuery = `
      SELECT ppm.*, 
             p.builder_id AS package_builder_id,
             pli.builder_id AS item_builder_id
      FROM package_pricelist_item_map ppm
      JOIN package p ON ppm.package_id = p.package_id
      JOIN price_list_item pli ON ppm.price_list_item_id = pli.price_list_item_id
      WHERE ppm.id = $1
    `;
    const findResult = await client.query(findQuery, [id]);

    if (findResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Record not found");
    }

    const record = findResult.rows[0];

    if (
      record.package_builder_id !== builderId ||
      record.item_builder_id !== builderId
    ) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        403,
        "You cannot update records of another builder",
      );
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (package_id) {
      const pkgCheck = await client.query(
        "SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2",
        [package_id, builderId],
      );

      if (pkgCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid package_id. You can use only your own packages",
        );
      }

      const pkgActiveCheck = await client.query(
        "SELECT package_id FROM package WHERE package_id = $1 AND builder_id = $2 AND status = true",
        [package_id, builderId],
      );

      if (pkgActiveCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive package.");
      }

      fields.push(`package_id = $${index}`);
      values.push(package_id);
      index++;
    }

    if (price_list_item_id) {
      const itemCheck = await client.query(
        "SELECT price_list_item_id FROM price_list_item WHERE price_list_item_id = $1 AND builder_id = $2",
        [price_list_item_id, builderId],
      );

      if (itemCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid price_list_item_id. You can use only your own price list items",
        );
      }

      const itemActiveCheck = await client.query(
        "SELECT price_list_item_id FROM price_list_item WHERE price_list_item_id = $1 AND builder_id = $2 AND status = 'active'",
        [price_list_item_id, builderId],
      );

      if (itemActiveCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive price list item.");
      }

      fields.push(`price_list_item_id = $${index}`);
      values.push(price_list_item_id);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    if (package_id || price_list_item_id) {
      const finalPackageId = package_id || record.package_id;
      const finalItemId = price_list_item_id || record.price_list_item_id;

      const duplicateCheck = await client.query(
        `
        SELECT 1 FROM package_pricelist_item_map
        WHERE package_id = $1 AND price_list_item_id = $2 AND id <> $3
        `,
        [finalPackageId, finalItemId, id],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "This package is already mapped with this price list item.",
        );
      }
    }

    values.push(id);

    const updateQuery = `
      UPDATE package_pricelist_item_map
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        package: keysToCamelCase(updateResult.rows[0]),
      },
      "Package updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating package_pricelist_item_map:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
