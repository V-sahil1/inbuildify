const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createPriceListItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id, price_list_item_id, quantity, note } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(res, 401, "Unauthorized");
    }

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
       (house_land_package_id, price_list_item_id, quantity, total_price, note) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [house_land_package_id, price_list_item_id, quantityToUse, totalPrice, note || null]
    );

    const detailedMapping = await client.query(
      `SELECT plim.*, pli.item_description as price_list_item_description, hlp.title as package_title, COALESCE(pli.cost, 0) as cost
       FROM h_l_package_pricelist_item_map plim
       JOIN price_list_item pli ON plim.price_list_item_id = pli.price_list_item_id
       JOIN house_land_package hlp ON plim.house_land_package_id = hlp.house_land_package_id
       WHERE plim.id = $1`,
      [mappingResult.rows[0].id]
    );

    const houseTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const currentPriceTotal = parseFloat(houseTotalSum.rows[0].total);

    const commissionTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const currentCommissionTotal = parseFloat(commissionTotalSum.rows[0].total);

    const row = detailedMapping.rows[0];
    const formattedMapping = {
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      priceListItemId: row.price_list_item_id,
      priceListItemDescription: row.price_list_item_description,
      packageTitle: row.package_title,
      quantity: parseInt(row.quantity),
      totalPrice: parseFloat(row.total_price),
      cost: parseFloat(row.cost),
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return successResponse(
      res,
      {
        mapping: formattedMapping,
        houseTotal: currentPriceTotal + currentCommissionTotal,
        commissionTotal: currentCommissionTotal
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

exports.getPriceListItemMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const packageCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package WHERE house_land_package_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [house_land_package_id, companyId, builderId]
    );

    if (packageCheck.rowCount === 0) {
      return successResponse(res, [], "Package not found");
    }

    const result = await client.query(
      `SELECT plim.*, pli.item_description as price_list_item_description, hlp.title as package_title, COALESCE(pli.cost, 0) as cost
       FROM h_l_package_pricelist_item_map plim
       JOIN price_list_item pli ON plim.price_list_item_id = pli.price_list_item_id
       JOIN house_land_package hlp ON plim.house_land_package_id = hlp.house_land_package_id
       WHERE plim.house_land_package_id = $1 AND pli.status = 'active'
       ORDER BY plim.created_at DESC`,
      [house_land_package_id]
    );

    const housePriceSumResult = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const housePriceTotal = parseFloat(housePriceSumResult.rows[0].total);

    const commissionTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const commissionTotal = parseFloat(commissionTotalSum.rows[0].total);

    const formattedMappings = result.rows.map(row => ({
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      priceListItemId: row.price_list_item_id,
      priceListItemDescription: row.price_list_item_description,
      packageTitle: row.package_title,
      quantity: parseInt(row.quantity),
      totalPrice: parseFloat(row.total_price),
      cost: parseFloat(row.cost),
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return successResponse(
      res,
      {
        mappings: formattedMappings,
        houseTotal: housePriceTotal + commissionTotal,
        commissionTotal: commissionTotal
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

    const rows = result.rows;
    const housePriceSum = rows.reduce((sum, row) => sum + parseFloat(row.total_price || 0), 0);

    const commissionSumResult = await client.query(
      `SELECT COALESCE(SUM(pcm.total_commission), 0) as total
       FROM h_l_package_commission_map pcm
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE (
         (hlp.company_id = $1 AND $1 IS NOT NULL)
         OR (hlp.builder_id = $2 AND $2 IS NOT NULL)
       )`,
      [companyId, builderId]
    );

    const organizationCommissionTotal = parseFloat(commissionSumResult.rows[0].total);

    const formattedMappings = result.rows.map(row => ({
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      priceListItemId: row.price_list_item_id,
      priceListItemDescription: row.item_description,
      packageTitle: row.package_title,
      quantity: parseInt(row.quantity),
      totalPrice: parseFloat(row.total_price),
      cost: parseFloat(row.cost),
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return successResponse(
      res,
      {
        mappings: formattedMappings,
        houseTotal: housePriceSum + organizationCommissionTotal,
        commissionTotal: organizationCommissionTotal
      },
      "All price list item mappings fetched successfully"
    );
  } catch (error) {
    console.error("Get all price list item mappings error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updatePriceListItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { quantity, note } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

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

    let updateValues = [quantityToUse, totalPrice, id];
    let updateQuery = `UPDATE h_l_package_pricelist_item_map 
                       SET quantity = $1, total_price = $2, updated_at = CURRENT_TIMESTAMP`;
    
    if (note !== undefined) {
      updateQuery += `, note = $4`;
      updateValues.push(note);
    }
    
    updateQuery += ` WHERE id = $3 RETURNING *`;

    const mappingResult = await client.query(updateQuery, updateValues);

    const detailedMapping = await client.query(
      `SELECT plim.*, pli.item_description as price_list_item_description, hlp.title as package_title, COALESCE(pli.cost, 0) as cost
       FROM h_l_package_pricelist_item_map plim
       JOIN price_list_item pli ON plim.price_list_item_id = pli.price_list_item_id
       JOIN house_land_package hlp ON plim.house_land_package_id = hlp.house_land_package_id
       WHERE plim.id = $1`,
      [id]
    );

    const houseTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );
    const currentPriceTotal = parseFloat(houseTotalSum.rows[0].total);

    const commissionTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );
    const currentCommissionTotal = parseFloat(commissionTotalSum.rows[0].total);

    const row = detailedMapping.rows[0];
    const formattedMapping = {
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      priceListItemId: row.price_list_item_id,
      priceListItemDescription: row.price_list_item_description,
      packageTitle: row.package_title,
      quantity: parseInt(row.quantity),
      totalPrice: parseFloat(row.total_price),
      cost: parseFloat(row.cost),
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return successResponse(
      res,
      {
        mapping: formattedMapping,
        houseTotal: currentPriceTotal + currentCommissionTotal,
        commissionTotal: currentCommissionTotal
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

exports.deletePriceListItemMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const checkResult = await client.query(
      `SELECT plim.id, plim.house_land_package_id
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

    const houseTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );
    const housePriceTotal = parseFloat(houseTotalSum.rows[0].total);

    const commissionTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [checkResult.rows[0].house_land_package_id]
    );
    const commissionTotal = parseFloat(commissionTotalSum.rows[0].total);

    return successResponse(
      res,
      {
        houseTotal: housePriceTotal + commissionTotal,
        commissionTotal: commissionTotal
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
    const createdIds = [];

    for (const commissionId of jobCommissionIds) {
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

      const duplicateCheck = await client.query(
        `SELECT id FROM h_l_package_commission_map 
         WHERE house_land_package_id = $1 AND job_commission_id = $2 LIMIT 1`,
        [house_land_package_id, commissionId]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, `Commission ${commissionId} is already mapped to this house land package`);
      }

      const subStageSum = await client.query(
        "SELECT COALESCE(SUM(commission_value), 0) as total FROM job_commission_sub_stage WHERE job_commission_id = $1",
        [commissionId]
      );
      const calculatedTotal = parseFloat(subStageSum.rows[0].total);

      const mappingResult = await client.query(
        `INSERT INTO h_l_package_commission_map 
         (house_land_package_id, job_commission_id, total_commission) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [house_land_package_id, commissionId, calculatedTotal]
      );
      createdIds.push(mappingResult.rows[0].id);
    }

    const detailedMappings = await client.query(
      `SELECT pcm.*, jc.name as commission_name, hlp.title as package_title
       FROM h_l_package_commission_map pcm
       JOIN job_commission jc ON pcm.job_commission_id = jc.job_commission_id
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE pcm.id = ANY($1)`,
      [createdIds]
    );

    const housePriceSumResult = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const housePriceTotal = parseFloat(housePriceSumResult.rows[0].total);

    const totalSumResult = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const currentCommissionTotal = parseFloat(totalSumResult.rows[0].total);

    await client.query("COMMIT");

    const formattedMappings = detailedMappings.rows.map(row => ({
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      jobCommissionId: row.job_commission_id,
      commissionName: row.commission_name,
      packageTitle: row.package_title,
      totalCommission: parseFloat(row.total_commission),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return successResponse(
      res,
      {
        mapping: formattedMappings[0],
        houseTotal: housePriceTotal + currentCommissionTotal,
        commissionTotal: currentCommissionTotal
      },
      "Package commission mapping created successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create package commission mapping error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getPackageCommissionMaps = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    const packageCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package WHERE house_land_package_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [house_land_package_id, companyId, builderId]
    );

    if (packageCheck.rowCount === 0) {
      return successResponse(res, [], "Package not found");
    }

    const housePriceSumResult = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const housePriceTotal = parseFloat(housePriceSumResult.rows[0].total);

    const commissionTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const commissionTotal = parseFloat(commissionTotalSum.rows[0].total);

    const result = await client.query(
      `SELECT pcm.*, jc.name as commission_name, jc.commission_type, hlp.title as package_title
       FROM h_l_package_commission_map pcm
       JOIN job_commission jc ON pcm.job_commission_id = jc.job_commission_id
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE pcm.house_land_package_id = $1
       ORDER BY pcm.created_at DESC`,
      [house_land_package_id]
    );

    const formattedMappings = result.rows.map(row => ({
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      jobCommissionId: row.job_commission_id,
      commissionName: row.commission_name,
      packageTitle: row.package_title,
      totalCommission: parseFloat(row.total_commission),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return successResponse(
      res,
      {
        mappings: formattedMappings,
        houseTotal: housePriceTotal + commissionTotal,
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

    const totalCommissionSum = result.rows.reduce((sum, row) => sum + parseFloat(row.total_commission || 0), 0);

    const formattedMappings = result.rows.map(row => ({
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      jobCommissionId: row.job_commission_id,
      commissionName: row.commission_name,
      packageTitle: row.package_title,
      totalCommission: parseFloat(row.total_commission),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return successResponse(
      res,
      {
        mappings: formattedMappings,
        commissionTotal: totalCommissionSum
      },
      "All package commission mappings fetched successfully"
    );
  } catch (error) {
    console.error("Get all package commission mappings error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updatePackageCommissionMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { job_commission_id } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    await client.query("BEGIN");

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

    const detailedMapping = await client.query(
      `SELECT pcm.*, jc.name as commission_name, hlp.title as package_title
       FROM h_l_package_commission_map pcm
       JOIN job_commission jc ON pcm.job_commission_id = jc.job_commission_id
       JOIN house_land_package hlp ON pcm.house_land_package_id = hlp.house_land_package_id
       WHERE pcm.id = $1`,
      [id]
    );

    const housePriceSumResult = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const housePriceTotal = parseFloat(housePriceSumResult.rows[0].total);

    const totalSumResult = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const currentCommissionTotal = parseFloat(totalSumResult.rows[0].total);

    await client.query("COMMIT");

    const row = detailedMapping.rows[0];
    const formattedMapping = {
      id: row.id,
      houseLandPackageId: row.house_land_package_id,
      jobCommissionId: row.job_commission_id,
      commissionName: row.commission_name,
      packageTitle: row.package_title,
      totalCommission: parseFloat(row.total_commission),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return successResponse(
      res,
      {
        mapping: formattedMapping,
        houseTotal: housePriceTotal + currentCommissionTotal,
        commissionTotal: currentCommissionTotal
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

exports.deletePackageCommissionMap = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    await client.query("BEGIN");

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

    const housePriceSumResult = await client.query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const housePriceTotal = parseFloat(housePriceSumResult.rows[0].total);

    const commissionTotalSum = await client.query(
      "SELECT COALESCE(SUM(total_commission), 0) as total FROM h_l_package_commission_map WHERE house_land_package_id = $1",
      [house_land_package_id]
    );
    const currentCommissionTotal = parseFloat(commissionTotalSum.rows[0].total || 0);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        houseTotal: housePriceTotal + currentCommissionTotal,
        commissionTotal: currentCommissionTotal
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