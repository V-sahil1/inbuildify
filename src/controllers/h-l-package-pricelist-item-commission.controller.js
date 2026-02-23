const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

// Create price list item mapping
exports.createPriceListItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id, price_list_item_id, quantity } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(res, 401, "Unauthorized");
    }

    // Validate house land package ownership
    const packageCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package WHERE house_land_package_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [house_land_package_id, companyId, builderId]
    );

    if (packageCheck.rowCount === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    // Get price from price_list_item and validate ownership
    const priceCheck = await client.query(
      `SELECT cost FROM price_list_item WHERE price_list_item_id = $1 AND status = 'active' AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [price_list_item_id, companyId, builderId]
    );

    if (priceCheck.rowCount === 0) {
      return errorResponse(res, 404, "Price list item not found or does not belong to your organization");
    }

    // Check for duplicate mapping
    const duplicateCheck = await client.query(
      `SELECT id FROM h_l_package_pricelist_item_map 
       WHERE house_land_package_id = $1 AND price_list_item_id = $2 LIMIT 1`,
      [house_land_package_id, price_list_item_id]
    );

    if (duplicateCheck.rowCount > 0) {
      return errorResponse(res, 400, "This price list item is already mapped to this house land package");
    }

    const quantityToUse = quantity || 1;
    const price = parseFloat(priceCheck.rows[0].cost) || 0;
    const totalPrice = price * quantityToUse;

    const mappingResult = await client.query(
      `INSERT INTO h_l_package_pricelist_item_map 
       (house_land_package_id, price_list_item_id, quantity, total_price) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [house_land_package_id, price_list_item_id, quantityToUse, totalPrice]
    );

    // Update house_land_package house_total
    const houseTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const newHouseTotal = parseFloat(houseTotalSum.rows[0].total);

    await client.query(
      "UPDATE house_land_package SET house_total = $1 WHERE house_land_package_id = $2",
      [newHouseTotal, house_land_package_id]
    );

    // Get updated totals from house_land_package
    const packageTotals = await client.query(
      "SELECT house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1",
      [house_land_package_id]
    );

    return successResponse(
      res,
      {
        mapping: keysToCamelCase(mappingResult.rows[0]),
        houseTotal: parseFloat(packageTotals.rows[0].house_total),
        commissionTotal: parseFloat(packageTotals.rows[0].commission_total)
      },
      "Price list item mapping created successfully"
    );
  } catch (error) {
    console.error("Create price list item mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Get all price list item mappings for a package
exports.getPriceListItemMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    // Validate house land package ownership
    const packageCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package WHERE house_land_package_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [house_land_package_id, companyId, builderId]
    );

    if (packageCheck.rowCount === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    const result = await client.query(
      `SELECT plim.*, COALESCE(pli.cost, 0) as cost, pli.name as price_list_item_name
       FROM h_l_package_pricelist_item_map plim
       JOIN price_list_item pli ON plim.price_list_item_id = pli.price_list_item_id
       WHERE plim.house_land_package_id = $1 AND pli.status = 'active'
       ORDER BY plim.created_at DESC`,
      [house_land_package_id]
    );

    // Get totals from house_land_package
    const packageTotals = await client.query(
      "SELECT house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1",
      [house_land_package_id]
    );

    return successResponse(
      res,
      {
        mappings: keysToCamelCase(result.rows),
        houseTotal: parseFloat(packageTotals.rows[0].house_total),
        commissionTotal: parseFloat(packageTotals.rows[0].commission_total)
      },
      "Price list item mappings fetched successfully"
    );
  } catch (error) {
    console.error("Get price list item mappings error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Get all price list item mappings for the organization
exports.getAllPriceListItemMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const result = await client.query(
      `SELECT plim.*, COALESCE(pli.cost, 0) as cost, pli.item_description as price_list_item_description, hlp.title as package_title
       FROM h_l_package_pricelist_item_map plim
       JOIN price_list_item pli ON plim.price_list_item_id = pli.price_list_item_id
       JOIN house_land_package hlp ON plim.house_land_package_id = hlp.house_land_package_id
       WHERE (
         (hlp.company_id = $1 AND $1 IS NOT NULL)
         OR (hlp.builder_id = $2 AND $2 IS NOT NULL)
       ) AND pli.status = 'active'
       ORDER BY plim.created_at DESC`,
      [companyId, builderId]
    );

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "All price list item mappings fetched successfully"
    );
  } catch (error) {
    console.error("Get all price list item mappings error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Update price list item mapping
exports.updatePriceListItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    // Check if mapping exists and user has access
    const checkResult = await client.query(
      `SELECT plim.*, hlp.company_id, hlp.builder_id, pli.cost
       FROM h_l_package_pricelist_item_map plim
       JOIN house_land_package hlp ON plim.house_land_package_id = hlp.house_land_package_id
       JOIN price_list_item pli ON plim.price_list_item_id = pli.price_list_item_id
       WHERE plim.id = $1 AND pli.status = 'active' AND (
         (hlp.company_id = $2 AND $2 IS NOT NULL)
         OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
       ) AND (
         (pli.company_id = $2 AND $2 IS NOT NULL)
         OR (pli.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Price list item mapping not found or price list item does not belong to your organization");
    }

    const quantityToUse = quantity || 1;
    const price = parseFloat(checkResult.rows[0].cost) || 0;
    const totalPrice = price * quantityToUse;

    const mappingResult = await client.query(
      `UPDATE h_l_package_pricelist_item_map 
       SET quantity = $1, total_price = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [quantityToUse, totalPrice, id]
    );

    // Update house_land_package house_total
    const houseTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );
    const newHouseTotal = parseFloat(houseTotalSum.rows[0].total);

    await client.query(
      "UPDATE house_land_package SET house_total = $1 WHERE house_land_package_id = $2",
      [newHouseTotal, checkResult.rows[0].house_land_package_id]
    );

    // Get updated totals from house_land_package
    const packageTotals = await client.query(
      "SELECT house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );

    return successResponse(
      res,
      {
        mapping: keysToCamelCase(mappingResult.rows[0]),
        houseTotal: parseFloat(packageTotals.rows[0].house_total),
        commissionTotal: parseFloat(packageTotals.rows[0].commission_total)
      },
      "Price list item mapping updated successfully"
    );
  } catch (error) {
    console.error("Update price list item mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Delete price list item mapping
exports.deletePriceListItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    // Check if mapping exists and user has access
    const checkResult = await client.query(
      `SELECT plim.id
       FROM h_l_package_pricelist_item_map plim
       JOIN house_land_package hlp ON plim.house_land_package_id = hlp.house_land_package_id
       WHERE plim.id = $1 AND (
         (hlp.company_id = $2 AND $2 IS NOT NULL)
         OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (checkResult.rowCount === 0) {
      return errorResponse(res, 404, "Price list item mapping not found");
    }

    await client.query("DELETE FROM h_l_package_pricelist_item_map WHERE id = $1", [id]);

    // Update house_land_package house_total
    const houseTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );
    const newHouseTotal = parseFloat(houseTotalSum.rows[0].total);

    await client.query(
      "UPDATE house_land_package SET house_total = $1 WHERE house_land_package_id = $2",
      [newHouseTotal, checkResult.rows[0].house_land_package_id]
    );

    // Get updated totals from house_land_package
    const packageTotals = await client.query(
      "SELECT house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );

    return successResponse(
      res,
      {
        houseTotal: parseFloat(packageTotals.rows[0].house_total),
        commissionTotal: parseFloat(packageTotals.rows[0].commission_total)
      },
      "Price list item mapping deleted successfully"
    );
  } catch (error) {
    console.error("Delete price list item mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// --- Package Commission Map CRUD ---

// Create package commission mapping
exports.createPackageCommissionMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id, job_commission_id } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    await client.query("BEGIN");

    // Validate house land package ownership
    const packageCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package WHERE house_land_package_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [house_land_package_id, companyId, builderId]
    );

    if (packageCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "House land package not found");
    }

    const jobCommissionIds = Array.isArray(job_commission_id) ? job_commission_id : [job_commission_id];
    const createdMappings = [];

    for (const commissionId of jobCommissionIds) {
      // Validate job commission ownership
      const commissionCheck = await client.query(
        `SELECT job_commission_id FROM job_commission WHERE job_commission_id = $1 AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR (builder_id = $3 AND $3 IS NOT NULL)
        ) LIMIT 1`,
        [commissionId, companyId, builderId]
      );

      if (commissionCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, `Job commission ${commissionId} not found or does not belong to your organization`);
      }

      // Check for duplicate mapping
      const duplicateCheck = await client.query(
        `SELECT id FROM h_l_package_commission_map 
         WHERE house_land_package_id = $1 AND job_commission_id = $2 LIMIT 1`,
        [house_land_package_id, commissionId]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, `Commission ${commissionId} is already mapped to this house land package`);
      }

      // Calculate total_commission from sub-stages
      const subStageSum = await client.query(
        "SELECT COALESCE(SUM(commission_value), 0) as total FROM job_commission_sub_stage WHERE job_commission_id = $1",
        [commissionId]
      );
      const calculatedTotal = parseFloat(subStageSum.rows[0].total);

      const mappingResult = await client.query(
        `INSERT INTO h_l_package_commission_map 
         (house_land_package_id, job_commission_id, total_commission) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [house_land_package_id, commissionId, calculatedTotal]
      );
      createdMappings.push(mappingResult.rows[0]);
    }

    // Update house_land_package commission_total
    const totalSumResult = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const newCommissionTotal = parseFloat(totalSumResult.rows[0].total);

    await client.query(
      "UPDATE house_land_package SET commission_total = $1 WHERE house_land_package_id = $2",
      [newCommissionTotal, house_land_package_id]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        mappings: keysToCamelCase(createdMappings),
        houseTotal: parseFloat(packageCheck.rows[0].house_total || 0), // Fetching from earlier query if needed, but safer to re-query for absolute consistency
        commissionTotal: newCommissionTotal
      },
      "Package commission mapping(s) created successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create package commission mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Get mappings for a specific package
exports.getPackageCommissionMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    // Validate house land package ownership and get totals
    const packageCheck = await client.query(
      `SELECT house_land_package_id, house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [house_land_package_id, companyId, builderId]
    );

    if (packageCheck.rowCount === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    const houseTotal = parseFloat(packageCheck.rows[0].house_total);
    const commissionTotal = parseFloat(packageCheck.rows[0].commission_total);

    const result = await client.query(
      `SELECT pcm.*, jc.name as commission_name, jc.commission_type
       FROM h_l_package_commission_map pcm
       JOIN job_commission jc ON pcm.job_commission_id = jc.job_commission_id
       WHERE pcm.house_land_package_id = $1
       ORDER BY pcm.created_at DESC`,
      [house_land_package_id]
    );

    return successResponse(
      res,
      {
        mappings: keysToCamelCase(result.rows),
        houseTotal,
        commissionTotal
      },
      "Package commission mappings fetched successfully"
    );
  } catch (error) {
    console.error("Get package commission mappings error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Get all mappings for the organization
exports.getAllPackageCommissionMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const result = await client.query(
      `SELECT pcm.*, jc.name as commission_name, hlp.title as package_title
       FROM h_l_package_commission_map pcm
       JOIN job_commission jc ON pcm.job_commission_id = jc.job_commission_id
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE (
         (hlp.company_id = $1 AND $1 IS NOT NULL)
         OR (hlp.builder_id = $2 AND $2 IS NOT NULL)
       )
       ORDER BY pcm.created_at DESC`,
      [companyId, builderId]
    );

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "All package commission mappings fetched successfully"
    );
  } catch (error) {
    console.error("Get all package commission mappings error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Update package commission mapping
exports.updatePackageCommissionMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { job_commission_id } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    await client.query("BEGIN");

    // Check if mapping exists and get house_land_package_id
    const checkResult = await client.query(
      `SELECT pcm.id, pcm.house_land_package_id, pcm.job_commission_id as old_commission_id
       FROM h_l_package_commission_map pcm
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE pcm.id = $1 AND (
         (hlp.company_id = $2 AND $2 IS NOT NULL)
         OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Package commission mapping not found");
    }

    const house_land_package_id = checkResult.rows[0].house_land_package_id;
    const commissionIdToUse = job_commission_id || checkResult.rows[0].old_commission_id;

    // Validate new job commission ownership if provided
    if (job_commission_id) {
      const commissionCheck = await client.query(
        `SELECT job_commission_id FROM job_commission WHERE job_commission_id = $1 AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR (builder_id = $3 AND $3 IS NOT NULL)
        ) LIMIT 1`,
        [job_commission_id, companyId, builderId]
      );

      if (commissionCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Job commission not found or does not belong to your organization");
      }
    }

    // Recalculate total_commission from sub-stages
    const subStageSum = await client.query(
      "SELECT COALESCE(SUM(commission_value), 0) as total FROM job_commission_sub_stage WHERE job_commission_id = $1",
      [commissionIdToUse]
    );
    const calculatedTotal = parseFloat(subStageSum.rows[0].total);

    const mappingResult = await client.query(
      `UPDATE h_l_package_commission_map 
       SET job_commission_id = $1, total_commission = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [commissionIdToUse, calculatedTotal, id]
    );

    // Update house_land_package commission_total
    const totalSumResult = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const newCommissionTotal = parseFloat(totalSumResult.rows[0].total);

    await client.query(
      "UPDATE house_land_package SET commission_total = $1 WHERE house_land_package_id = $2",
      [newCommissionTotal, house_land_package_id]
    );

    await client.query("COMMIT");

    // Get updated totals
    const packageTotals = await client.query(
      "SELECT house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1",
      [house_land_package_id]
    );

    return successResponse(
      res,
      {
        mapping: keysToCamelCase(mappingResult.rows[0]),
        houseTotal: parseFloat(packageTotals.rows[0].house_total),
        commissionTotal: parseFloat(packageTotals.rows[0].commission_total)
      },
      "Package commission mapping updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update package commission mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

// Delete package commission mapping
exports.deletePackageCommissionMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    await client.query("BEGIN");

    // Check if mapping exists and get house_land_package_id
    const checkResult = await client.query(
      `SELECT pcm.id, pcm.house_land_package_id
       FROM h_l_package_commission_map pcm
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE pcm.id = $1 AND (
         (hlp.company_id = $2 AND $2 IS NOT NULL)
         OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [id, companyId, builderId]
    );

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Package commission mapping not found");
    }

    const house_land_package_id = checkResult.rows[0].house_land_package_id;

    await client.query("DELETE FROM h_l_package_commission_map WHERE id = $1", [id]);

    // Get updated totals from house_land_package
    const packageTotals = await client.query(
      "SELECT house_total, commission_total FROM house_land_package WHERE house_land_package_id = $1",
      [house_land_package_id]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        houseTotal: parseFloat(packageTotals.rows[0].house_total),
        commissionTotal: parseFloat(packageTotals.rows[0].commission_total)
      },
      "Package commission mapping deleted successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete package commission mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};