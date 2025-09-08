const getPool = require("../config/database");
const { generateCode } = require("../helper/codeGenerator");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

function validateReferences(row, res, errorResponse) {
  switch (true) {
    case row.lead_exists == 0:
      errorResponse(
        res,
        400,
        "Lead does not exist, or its status is not IN_PROGRESS/COMPLETED."
      );
      return true;

    case row.property_exists == 0:
      errorResponse(
        res,
        400,
        "Property does not exist, or it does not belong to this builder/lead."
      );
      return true;

    case row.floor_plan_exists == 0:
      errorResponse(
        res,
        400,
        "Floor plan does not exist, or it does not match the given range/dwelling type."
      );
      return true;

    case row.facade_exists == 0:
      errorResponse(
        res,
        400,
        "Facade does not exist, or it does not match the given dwelling type."
      );
      return true;

    case row.package_exists == 0:
      errorResponse(
        res,
        400,
        "Package does not exist, or it does not belong to this builder/range/dwelling type, or is not ACTIVE."
      );
      return true;

    default:
      return false;
  }
}

function parseItemsAndCalculateTotal(itemsRaw, packageAmount) {
  let items = [];
  try {
    items = Array.isArray(itemsRaw) ? itemsRaw : JSON.parse(itemsRaw || "[]");
  } catch {
    items = [];
  }

  let itemsTotal = 0;
  items = items.map((item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0);
    const total = price * quantity;
    itemsTotal += total;
    return {
      ...item,
      price,
      quantity,
      total,
    };
  });

  const packageAmt = Number(packageAmount || 0);
  const totalAmount = itemsTotal + packageAmt;

  return { items, totalAmount };
}

exports.createQuotation = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const builderId = req.user.builder_id;
  const userId = req.user.users_id;
  const {
    range,
    dwellingType,
    leadId,
    propertyId,
    floorPlanId,
    facadeId,
    packageId,
    items,
    notes,
  } = req.body;

  try {
    await client.query("BEGIN");

    const rangeQuery = `SELECT range_id FROM range WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false;`;
    const rangeResult = await client.query(rangeQuery, [range, builderId]);
    const rangeId = rangeResult.rows[0]?.range_id;
    console.log("🚀 ~ quotation.controller.js:105 ~ rangeId:", rangeId);
    if (!rangeId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid range ID or range does not exist."
      );
    }

    const dwellingTypeQuery = `SELECT dwelling_type_id FROM dwelling_type WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false;`;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [
      dwellingType,
      builderId,
    ]);
    const dwellingTypeId = dwellingTypeResult.rows[0]?.dwelling_type_id;
    console.log("🚀 ~ quotation.controller.js:116 ~ dwellingTypeId:", dwellingTypeId);
    if (!dwellingTypeId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid dwelling type ID or dwelling type does not exist."
      );
    }

    const validationQuery = `
      SELECT 
        (SELECT COUNT(*) FROM leads WHERE builder_id = $1 AND lead_id = $2 AND is_deleted = false AND status IN ('IN_PROGRESS', 'COMPLETED')) as lead_exists,
        (SELECT COUNT(*) FROM property WHERE property_id = $3 AND builder_id = $1 AND lead_id = $2) as property_exists,
        (SELECT COUNT(*) FROM floor_plan WHERE floor_plan_id = $4 AND builder_id = $1 AND range_id = $7 AND dwelling_type_id = $8) as floor_plan_exists,
        (SELECT COUNT(*) FROM facade WHERE facade_id = $5 AND builder_id = $1 AND dwelling_type_id = $8) as facade_exists,
        (SELECT COUNT(*) FROM packages p LEFT JOIN category_items ci ON ci.category_item_id = ANY(p.category_item_ids) WHERE p.package_id = $6 AND p.builder_id = $1 AND ci.range_id = $7 AND ci.dwelling_type_id = $8 AND ci.status = 'ACTIVE') as package_exists;
    `;
    const validationResult = await client.query(validationQuery, [
      builderId,
      leadId,
      propertyId,
      floorPlanId,
      facadeId,
      packageId,
      rangeId,
      dwellingTypeId,
    ]);
    const row = validationResult.rows[0];
    console.log("🚀 ~ quotation.controller.js:139 ~ row:", row);

    const error = validateReferences(row, res, errorResponse);
    if (error) return;

    if (!Array.isArray(items) || items.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Items array is required and must not be empty."
      );
    }
    for (const item of items) {
      if (
        !item.itemId ||
        typeof item.quantity !== "number" ||
        typeof item.price !== "number" ||
        typeof item.total !== "number"
      ) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Each item must have itemId, quantity, price, total which are of type number."
        );
      }
    }

    const slugId = generateCode(req.user.name, "quotation");
    const insertQuotationQuery = `
      INSERT INTO quotation (
        slugId, builder_id, lead_id, property_id, floor_plan_id, facade_id, package_id, range_id, dwelling_type_id, created_by_id, updated_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const quotationResult = await client.query(insertQuotationQuery, [
      slugId,
      builderId,
      leadId,
      propertyId,
      floorPlanId,
      facadeId,
      packageId,
      rangeId,
      dwellingTypeId,
      userId,
      userId,
    ]);
    const quotation = quotationResult.rows[0];

    const insertVersionQuery = `
      INSERT INTO quotation_versions (quotation_id, version_number, notes)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const versionResult = await client.query(insertVersionQuery, [
      quotation.quotation_id,
      1,
      notes || null,
    ]);
    const version = versionResult.rows[0];

    const itemIds = items.map((i) => i.itemId);
    const itemDetailsResult = await client.query(
      `SELECT 
          ci.category_item_id,
          ci.category_id,
          c.name AS category_name,
          c.description AS category_description,
          ci.description AS category_item_description,
          ci.short_description AS category_item_short_description,
          ci.cost AS category_item_cost,
          ci.uom AS category_item_uom,
          ci.sort_order AS category_item_sort_order,
          ci.include_by_default,
          ci.show_in_hl_package,
          ci.package_only,
          ci.cost_type,
          ci.cost_option,
          ci.cost_type_text,
          ci.range_id,
          ci.dwelling_type_id,
          ci.created_at AS category_item_created_at,
          ci.updated_at AS category_item_updated_at
      FROM category_items ci
      JOIN categories c ON c.category_id = ci.category_id
      WHERE ci.category_item_id = ANY($1)
      `,
      [itemIds]
    );

    const detailsMap = new Map(
      itemDetailsResult.rows.map((r) => [r.category_item_id, r])
    );

    const values = [];
    const placeholders = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const d = detailsMap.get(item.itemId);

      if (!d) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, `Invalid category item: ${item.itemId}`);
      }

      const baseIndex = i * 19;
      placeholders.push(`(
        $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${
        baseIndex + 4
      }, 
        $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${
        baseIndex + 8
      }, 
        $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${
        baseIndex + 12
      }, 
        $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${
        baseIndex + 16
      }, 
        $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, NOW(), NOW()
      )`);

      values.push(
        version.quotation_version_id,
        notes || null,
        d.category_id,
        d.category_name,
        d.category_description,
        d.category_item_id,
        d.category_item_description,
        d.category_item_short_description,
        d.cost_type,
        item.price ?? d.category_item_cost,
        d.cost_type_text,
        d.cost_option,
        d.include_by_default,
        d.show_in_hl_package,
        d.package_only,
        d.category_item_uom,
        d.category_item_sort_order,
        d.range_id,
        d.dwelling_type_id
      );
    }

    const insertItemQuery = `
      INSERT INTO quotation_version_items (
        quotation_version_id,
        notes,
        category_id,
        caterogy_name,
        category_description,
        category_item_id,
        category_item_description,
        category_item_short_description,
        category_item_cost_type,
        category_item_cost,
        category_item_cost_type_text,
        category_item_cost_option,
        category_item_include_by_default,
        category_item_show_in_hl_package,
        category_item_package_only,
        category_item_uom,
        category_item_sort_order,
        category_item_range_id,
        category_item_dwelling_type_id,
        created_at,
        updated_at
      )
      VALUES ${placeholders.join(", ")}
    `;

    await client.query(insertItemQuery, values);

    await client.query(
      `UPDATE leads SET status = 'COMPLETED' WHERE lead_id = $1`,
      [leadId]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(quotation),
      "Quotation created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Error creating quotation"
    );
  } finally {
    client.release();
  }
};

exports.getQuotationById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { quotation_id } = req.params;
  const builderId = req.user.builder_id;

  try {
    const query = `
        SELECT 
          q.slug_id, q.quotation_id, q.created_at, q.updated_at,
          b.builder_id, b.name as builder_name,
          l.lead_id, l.status as lead_status,
          p.property_id, p.address1 as property_address,
          f.floor_plan_id, f.name as floor_plan_name,
          fa.facade_id, fa.name as facade_name,
          pk.package_id, pk.name as package_name, pk.amount as package_amount,
          r.range_id, r.name as range_name,
          dt.dwelling_type_id, dt.name as dwelling_type_name
        FROM quotation q
        JOIN builder b ON q.builder_id = b.builder_id
        JOIN leads l ON q.lead_id = l.lead_id
        JOIN property p ON q.property_id = p.property_id
        JOIN floor_plan f ON q.floor_plan_id = f.floor_plan_id
        JOIN facade fa ON q.facade_id = fa.facade_id
        JOIN packages pk ON q.package_id = pk.package_id
        JOIN range r ON q.range_id = r.range_id
        JOIN dwelling_type dt ON q.dwelling_type_id = dt.dwelling_type_id
        WHERE q.quotation_id = $1 AND q.builder_id = $2;
      `;

    const result = await client.query(query, [quotation_id, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "Quotation not found.");
    }

    const row = keysToCamelCase(result.rows[0]);

    const { items, totalAmount } = parseItemsAndCalculateTotal(
      row.items,
      row.packageAmount
    );

    const versionsQuery = `
      SELECT 
        qv.quotation_version_id, qv.version_number, qv.notes,
        qv.created_at, qv.updated_at,
        qvi.quotation_version_item_id, qvi.notes as item_notes,
        qvi.category_id, qvi.caterogy_name, qvi.category_description,
        qvi.category_item_id, qvi.category_item_description, qvi.category_item_short_description,
        qvi.category_item_cost_type, qvi.category_item_cost, qvi.category_item_cost_type_text,
        qvi.category_item_cost_option, qvi.category_item_include_by_default,
        qvi.category_item_show_in_hl_package, qvi.category_item_package_only,
        qvi.category_item_uom, qvi.category_item_sort_order,
        qvi.category_item_range_id, qvi.category_item_dwelling_type_id,
        qvi.category_item_created_at, qvi.category_item_updated_at,
        qvi.created_at as item_created_at, qvi.updated_at as item_updated_at
      FROM quotation_versions qv
      LEFT JOIN quotation_version_items qvi ON qv.quotation_version_id = qvi.quotation_version_id
      WHERE qv.quotation_id = $1
      ORDER BY qv.version_number ASC, qvi.created_at ASC;
    `;
    const versionsResult = await client.query(versionsQuery, [quotation_id]);

    const versionsMap = {};

    versionsResult.rows.forEach((row) => {
      const versionNumber = row.version_number;

      if (!versionsMap[versionNumber]) {
        versionsMap[versionNumber] = [];
      }

      if (row.quotation_version_item_id) {
        versionsMap[versionNumber].push({
          quotationVersionItemId: row.quotation_version_item_id,
          notes: row.item_notes,
          categoryId: row.category_id,
          caterogyName: row.caterogy_name,
          categoryDescription: row.category_description,
          categoryItemId: row.category_item_id,
          categoryItemDescription: row.category_item_description,
          categoryItemShortDescription: row.category_item_short_description,
          categoryItemCostType: row.category_item_cost_type,
          categoryItemCost: row.category_item_cost,
          categoryItemCostTypeText: row.category_item_cost_type_text,
          categoryItemCostOption: row.category_item_cost_option,
          categoryItemIncludeByDefault: row.category_item_include_by_default,
          categoryItemShowInHlPackage: row.category_item_show_in_hl_package,
          categoryItemPackageOnly: row.category_item_package_only,
          categoryItemUom: row.category_item_uom,
          categoryItemSortOrder: row.category_item_sort_order,
          categoryItemRangeId: row.category_item_range_id,
          categoryItemDwellingTypeId: row.category_item_dwelling_type_id,
          categoryItemCreatedAt: row.category_item_created_at,
          categoryItemUpdatedAt: row.category_item_updated_at,
          createdAt: row.item_created_at,
          updatedAt: row.item_updated_at,
        });
      }
    });

    const responseData = {
      slugId: row.slugId,
      quotationId: row.quotationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalAmount,
      builder: {
        builderId: row.builderId,
        name: row.builderName,
      },
      lead: {
        leadId: row.leadId,
        status: row.leadStatus,
      },
      property: {
        propertyId: row.propertyId,
        address: row.propertyAddress,
      },
      floorPlan: {
        floorPlanId: row.floorPlanId,
        name: row.floorPlanName,
      },
      facade: {
        facadeId: row.facadeId,
        name: row.facadeName,
      },
      package: {
        packageId: row.packageId,
        name: row.packageName,
        amount: row.packageAmount,
      },
      range: {
        rangeId: row.rangeId,
        name: row.rangeName,
      },
      dwellingType: {
        dwellingTypeId: row.dwellingTypeId,
        name: row.dwellingTypeName,
      },
      versions: versionsMap,
    };

    return successResponse(
      res,
      responseData,
      "Quotation fetched successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      error?.code || 400,
      error?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.getQuotations = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const builderId = req.user.builder_id;
  const { page, limit, leadId } = req.query;

  try {
    await client.query("BEGIN");

    const offset = (page - 1) * limit;
    const quotationsQuery = `
      SELECT 
        q.slug_id, q.quotation_id, q.created_at, q.updated_at,
        b.builder_id, b.name as builder_name,
        l.lead_id, l.status as lead_status,
        p.property_id, p.address1 as property_address,
        f.floor_plan_id, f.name as floor_plan_name,
        fa.facade_id, fa.name as facade_name,
        pk.package_id, pk.name as package_name, pk.amount as package_amount,
        r.range_id, r.name as range_name,
        dt.dwelling_type_id, dt.name as dwelling_type_name
      FROM quotation q
      JOIN builder b ON q.builder_id = b.builder_id
      JOIN leads l ON q.lead_id = l.lead_id
      JOIN property p ON q.property_id = p.property_id
      JOIN floor_plan f ON q.floor_plan_id = f.floor_plan_id
      JOIN facade fa ON q.facade_id = fa.facade_id
      JOIN packages pk ON q.package_id = pk.package_id
      JOIN range r ON q.range_id = r.range_id
      JOIN dwelling_type dt ON q.dwelling_type_id = dt.dwelling_type_id
      WHERE q.builder_id = $1 AND q.lead_id = $2
      ORDER BY q.created_at DESC
      LIMIT $3 OFFSET $4;
    `;
    const quotationsResult = await client.query(quotationsQuery, [
      builderId,
      leadId,
      limit,
      offset,
    ]);
    const quotationIds = quotationsResult.rows.map((r) => r.quotation_id);

    let versionsByQuotation = {};
    if (quotationIds.length > 0) {
      const versionsQuery = `
        SELECT 
          qv.quotation_version_id,
          qv.quotation_id,
          qv.version_number,
          qv.notes,
          qv.created_at,
          qv.updated_at,
          COALESCE(SUM(qvi.category_item_cost), 0) as total_amount
        FROM quotation_versions qv
        LEFT JOIN quotation_version_items qvi 
          ON qv.quotation_version_id = qvi.quotation_version_id
        WHERE qv.quotation_id = ANY($1::uuid[])
        GROUP BY qv.quotation_version_id
        ORDER BY qv.version_number ASC;
      `;

      const versionsResult = await client.query(versionsQuery, [quotationIds]);

      versionsByQuotation = versionsResult.rows.reduce((acc, row) => {
        if (!acc[row.quotation_id]) acc[row.quotation_id] = [];
        acc[row.quotation_id].push({
          quotationVersionId: row.quotation_version_id,
          versionNumber: row.version_number,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          totalAmount: Number(row.total_amount),
        });
        return acc;
      }, {});
    }

    const quotations = quotationsResult.rows.map((row) => {
      const versions = versionsByQuotation[row.quotation_id] || [];
      const latestVersionTotal =
        versions.length > 0 ? versions[versions.length - 1].totalAmount : 0;
      const totalAmount = latestVersionTotal + Number(row.package_amount || 0);

      return {
        ...row,
        totalAmount,
        versions,
      };
    });

    const countQuery = `
      SELECT COUNT(*) as count
      FROM quotation
      WHERE builder_id = $1 AND lead_id = $2;
    `;
    const countResult = await client.query(countQuery, [builderId, leadId]);
    const count = countResult.rows[0].count;

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase({ count, quotations }),
      "Quotations fetched successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};
