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
        slug_id, builder_id, lead_id, property_id, created_by_id, updated_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const quotationResult = await client.query(insertQuotationQuery, [
      slugId,
      builderId,
      leadId,
      propertyId,
      userId,
      userId,
    ]);
    const quotation = quotationResult.rows[0];

    const insertVersionQuery = `
      INSERT INTO quotation_versions (quotation_id, version_number, notes, floor_plan_id, facade_id, package_id, range_id, dwelling_type_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const versionResult = await client.query(insertVersionQuery, [
      quotation.quotation_id,
      1,
      notes || null,
      floorPlanId,
      facadeId,
      packageId,
      rangeId,
      dwellingTypeId,
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

      const baseIndex = i * 20;
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
        $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${
        baseIndex + 20
      }, NOW(), NOW()
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
        item.quantity ?? d.category_item_quantity,
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
        category_item_quantity,
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

exports.createQuotationVersion = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  const { quotation_id } = req.params;
  const { notes, items, range, dwellingType, floorPlanId, facadeId, packageId, } = req.body;
  const builderId = req.user.builder_id;

  try {
    await client.query("BEGIN");

    const quotationRes = await client.query(
      `SELECT quotation_id FROM quotation WHERE quotation_id = $1 AND builder_id = $2`,
      [quotation_id, builderId]
    );
    if (quotationRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Quotation not found.");
    }

    const rangeQuery = `
      SELECT range_id FROM range 
      WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false;
    `;
    const rangeResult = await client.query(rangeQuery, [range, builderId]);
    const rangeId = rangeResult.rows[0]?.range_id;
    if (!rangeId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid range provided.");
    }

    const dwellingTypeQuery = `
      SELECT dwelling_type_id FROM dwelling_type 
      WHERE name = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false;
    `;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [
      dwellingType,
      builderId,
    ]);
    const dwellingTypeId = dwellingTypeResult.rows[0]?.dwelling_type_id;
    if (!dwellingTypeId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid dwelling type provided.");
    }

    const validationQuery = `
      SELECT 
        (SELECT COUNT(*) FROM floor_plan WHERE floor_plan_id = $1 AND builder_id = $4 AND range_id = $5 AND dwelling_type_id = $6) as floor_plan_exists,
        (SELECT COUNT(*) FROM facade WHERE facade_id = $2 AND builder_id = $4 AND dwelling_type_id = $6) as facade_exists,
        (SELECT COUNT(*) FROM packages p LEFT JOIN category_items ci ON ci.category_item_id = ANY(p.category_item_ids) WHERE p.package_id = $3 AND p.builder_id = $4 AND ci.range_id = $5 AND ci.dwelling_type_id = $6 AND ci.status = 'ACTIVE') as package_exists;
    `;
    const validationResult = await client.query(validationQuery, [
      floorPlanId,
      facadeId,
      packageId,
      builderId,
      rangeId,
      dwellingTypeId,
    ]);

    const vRow = validationResult.rows[0];
    if (parseInt(vRow.floor_plan_exists, 10) === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Floor plan does not exist, or it does not match the given range/dwelling type.");
    }
    if (parseInt(vRow.facade_exists, 10) === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Facade does not exist, or it does not match the given dwelling type.");
    }
    if (parseInt(vRow.package_exists, 10) === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Package does not exist, or it does not belong to this builder/range/dwelling type, or is not ACTIVE.");
    }

    const versionRes = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM quotation_versions WHERE quotation_id = $1`,
      [quotation_id]
    );
    const versionNumber = versionRes.rows[0].next_version;

    const insertVersion = `
      INSERT INTO quotation_versions (quotation_id, version_number, notes, floor_plan_id, facade_id, package_id, range_id, dwelling_type_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const newVersionRes = await client.query(insertVersion, [
      quotation_id,
      versionNumber,
      notes || null,
      floorPlanId,
      facadeId,
      packageId,
      rangeId,
      dwellingTypeId,
    ]);
    const newVersion = newVersionRes.rows[0];

    const itemIds = items.map((i) => i.itemId);
    const itemDetailsResult = await client.query(
      `SELECT ci.*, c.name as category_name, c.description as category_description
       FROM category_items ci
       JOIN categories c ON c.category_id = ci.category_id
       WHERE ci.category_item_id = ANY($1)`,
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

      const base = i * 20;
      placeholders.push(`(
        $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5},
        $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10},
        $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${
        base + 15
      },
        $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${
        base + 20
      }, NOW(), NOW()
      )`);

      values.push(
        newVersion.quotation_version_id,
        notes || null,
        d.category_id,
        d.category_name,
        d.category_description,
        d.category_item_id,
        d.description,
        d.short_description,
        d.cost_type,
        item.quantity,
        item.price,
        d.cost_type_text,
        d.cost_option,
        d.include_by_default,
        d.show_in_hl_package,
        d.package_only,
        d.uom,
        d.sort_order,
        d.range_id,
        d.dwelling_type_id
      );
    }

    const insertItems = `
      INSERT INTO quotation_version_items (
        quotation_version_id, notes, category_id, caterogy_name, category_description,
        category_item_id, category_item_description, category_item_short_description,
        category_item_cost_type, category_item_quantity, category_item_cost,
        category_item_cost_type_text, category_item_cost_option,
        category_item_include_by_default, category_item_show_in_hl_package,
        category_item_package_only, category_item_uom, category_item_sort_order,
        category_item_range_id, category_item_dwelling_type_id, created_at, updated_at
      )
      VALUES ${placeholders.join(", ")}
    `;
    await client.query(insertItems, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(newVersion),
      "Quotation version created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create quotation version error:", err);
    return errorResponse(res, 500, "Failed to create quotation version.");
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
          lc.leads_contact_id as lead_contact_id, lc.name as lead_contact_name, lc.email as lead_contact_email, lc.phone as lead_contact_phone,
          lc.secondary_phone as lead_contact_secondary_phone, lc.address1 as lead_contact_address1, lc.address2 as lead_contact_address2, lc.city as lead_contact_city, lc.zip as lead_contact_zip,
          p.property_id, p.builder_id AS property_builder_id, p.address1 as property_address, p.address2 as property_address2, p.lead_id AS property_lead_id,
          p.country, p.state_region, p.city_suburb, p.zip_postal_code,
          p.estate_name, p.title_status, p.title_date, p.compaction_report, p.land_type,
          p.width_m, p.depth_m, p.total_size_m2, p.site_fall_mm, p.land_fill_mm,
          p.bush_fire, p.corner_block, p.created_at AS property_created_at, p.updated_at AS property_updated_at,
          f.floor_plan_id, f.builder_id AS floor_plan_builder_id, f.name AS floor_plan_name,
          f.image AS floor_plan_image, f.range_id, f.dwelling_type_id AS floor_plan_dwelling_type_id,
          f.beds, f.bath, f.car_park, f.width_meter, f.depth_meter,
          f.dwelling, f.garage, f.porch, f.alfresco, f.total_sqft, f.created_at AS floor_plan_created_at, f.updated_at AS floor_plan_updated_at,
          fa.facade_id, fa.builder_id AS facade_builder_id, fa.name AS facade_name,
          fa.image AS facade_image, fa.dwelling_type_id AS facade_dwelling_type_id,
          fa.standard, fa.upgrade, fa.cost, fa.is_deleted AS facade_is_deleted,
          fa.created_at AS facade_created_at, fa.updated_at AS facade_updated_at,
          pk.package_id, pk.name AS package_name, pk.builder_id AS package_builder_id,
          pk.category_item_ids, pk.amount as package_amount, pk.created_at AS package_created_at, pk.updated_at AS package_updated_at,
          r.range_id, r.name as range_name,
          dt.dwelling_type_id, dt.name as dwelling_type_name
        FROM quotation q
        JOIN quotation_versions qv ON q.quotation_id = qv.quotation_id
        JOIN builder b ON q.builder_id = b.builder_id
        JOIN leads l ON q.lead_id = l.lead_id LEFT JOIN leads_contact lc ON l.lead_id = lc.lead_id
        JOIN property p ON q.property_id = p.property_id
        JOIN floor_plan f ON qv.floor_plan_id = f.floor_plan_id
        JOIN facade fa ON qv.facade_id = fa.facade_id
        JOIN packages pk ON qv.package_id = pk.package_id
        JOIN range r ON qv.range_id = r.range_id
        JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
        WHERE q.quotation_id = $1 AND q.builder_id = $2;
      `;
    // property, plan, facade, package
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
        qvi.category_item_quantity,
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
          categoryItemQuantity: row.category_item_quantity,
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
        leadContact: {
          leadContactId: row.leadContactId,
          name: row.leadContactName,
          email: row.leadContactEmail,
          phone: row.leadContactPhone,
          secondaryPhone: row.leadContactSecondaryPhone,
          address1: row.leadContactAddress1,
          address2: row.leadContactAddress2,
          city: row.leadContactCity,
          zip: row.leadContactZip,
        },
      },
      property: {
        propertyId: row.propertyId,
        builderId: row.propertyBuilderId,
        address1: row.propertyAddress,
        address2: row.propertyAddress2,
        leadId: row.propertyLeadId,
        country: row.country,
        stateRegion: row.stateRegion,
        citySuburb: row.citySuburb,
        zipPostalCode: row.zipPostalCode,
        estateName: row.estateName,
        titleStatus: row.titleStatus,
        titleDate: row.titleDate,
        compactionReport: row.compactionReport,
        landType: row.landType,
        widthM: row.widthM,
        depthM: row.depthM,
        totalSizeM2: row.totalSizeM2,
        siteFallMm: row.siteFallMm,
        landFillMm: row.landFillMm,
        bushFire: row.bushFire,
        cornerBlock: row.cornerBlock,
        createdAt: row.propertyCreatedAt,
        updatedAt: row.propertyUpdatedAt,
      },
      floorPlan: {
        floorPlanId: row.floorPlanId,
        builderId: row.floorPlanBuilderId,
        name: row.floorPlanName,
        image: row.floorPlanImage,
        rangeId: row.rangeId,
        dwellingTypeId: row.floorPlanDwellingTypeId,
        beds: row.beds,
        bath: row.bath,
        carPark: row.carPark,
        widthMeter: row.widthMeter,
        depthMeter: row.depthMeter,
        dwelling: row.dwelling,
        garage: row.garage,
        porch: row.porch,
        alfresco: row.alfresco,
        totalSqft: row.total_sqft,
        createdAt: row.floorPlanCreatedAt,
        updatedAt: row.floorPlanUpdatedAt,
      },
      facade: {
        facadeId: row.facadeId,
        builderId: row.facadeBuilderId,
        name: row.facadeName,
        image: row.facadeImage,
        dwellingTypeId: row.facadeDwellingTypeId,
        standard: row.standard,
        upgrade: row.upgrade,
        cost: row.cost,
        isDeleted: row.facadeIsDeleted,
        createdAt: row.facadeCreatedAt,
        updatedAt: row.facadeUpdatedAt,
      },
      package: {
        packageId: row.packageId,
        name: row.packageName,
        builderId: row.packageBuilderId,
        amount: row.packageAmount,
        packageAmount: row.packageAmount,
        categoryItemIds: row.categoryItemIds,
        createdAt: row.packageCreatedAt,
        updatedAt: row.packageUpdatedAt,
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
      error?.statusCode || 400,
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
        fa.facade_id, fa.cost as facade_cost, fa.name as facade_name,
        pk.package_id, pk.name as package_name, pk.amount as package_amount,
        r.range_id, r.name as range_name,
        dt.dwelling_type_id, dt.name as dwelling_type_name
      FROM quotation q
      JOIN quotation_versions qv ON q.quotation_id = qv.quotation_id
      JOIN builder b ON q.builder_id = b.builder_id
      JOIN leads l ON q.lead_id = l.lead_id
      JOIN property p ON q.property_id = p.property_id
      JOIN floor_plan f ON qv.floor_plan_id = f.floor_plan_id
      JOIN facade fa ON qv.facade_id = fa.facade_id
      JOIN packages pk ON qv.package_id = pk.package_id
      JOIN range r ON qv.range_id = r.range_id
      JOIN dwelling_type dt ON qv.dwelling_type_id = dt.dwelling_type_id
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
          qv.floor_plan_id,
          qv.facade_id,
          qv.package_id,
          qv.range_id,
          qv.dwelling_type_id,
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
          floorPlanId: row.floor_plan_id,
          facadeId: row.facade_id,
          packageId: row.package_id,
          rangeId: row.range_id,
          dwellingTypeId: row.dwelling_type_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          totalAmount: Number(row.total_amount),
        });
        return acc;
      }, {});
    }

    const quotations = quotationsResult.rows.map((row) => {
      const versions = versionsByQuotation[row.quotation_id] || [];
      const latestVersionTotal = versions.length > 0 ? versions[versions.length - 1].totalAmount : 0;
      const totalAmount = latestVersionTotal + Number(row.package_amount || 0) + Number(row.facade_cost || 0);

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
