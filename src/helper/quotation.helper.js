import getPool from "../config/database.js";
import db from "../config/database/models/postgre-models/index.js";

/**
 * Synchronizes the "Compaction Report Charge" across all non-approved quotation versions 
 * of a lead based on the property's compaction report status.
 * 
 * @param {string} leadsId - The UUID of the lead.
 * @param {string} builderId - The UUID of the builder.
 * @param {string} companyId - The UUID of the company.
 * @param {string} userId - The UUID of the user performing the action.
 * @param {object} [client] - Optional database client for transaction support.
 */
export const syncCompactionReportCharge = async (leadsId, builderId, companyId, userId, client) => {
  try {
    let status, provider;
    let versions = [];

    if (client && typeof client.query === "function") {
      // Use raw SQL with the provided pg-client for transaction support
      const leadQuery = `
        SELECT pd.compaction_report, pd.compaction_report_provider
        FROM leads l
        JOIN property_detail pd ON l.property_detail_id = pd.property_detail_id
        WHERE l.leads_id = $1
      `;
      const leadResult = await client.query(leadQuery, [leadsId]);
      if (leadResult.rowCount === 0) return;
      status = leadResult.rows[0].compaction_report;
      provider = leadResult.rows[0].compaction_report_provider;

      const versionsQuery = `
        SELECT qv.quotation_version_id
        FROM quotation_version qv
        JOIN quotation q ON qv.quotation_id = q.quotation_id
        WHERE q.leads_id = $1 AND qv.is_approve = false
      `;
      const versionsResult = await client.query(versionsQuery, [leadsId]);
      versions = versionsResult.rows;
    } else {
      // Use Sequelize models (original logic)
      const { Leads, PropertyDetail, Quotation, QuotationVersion } = db;
      const lead = await Leads.findOne({
        where: { leads_id: leadsId },
        include: [
          {
            model: PropertyDetail,
            as: "propertyDetail",
            attributes: ["compaction_report", "compaction_report_provider"],
          },
        ],
      });

      if (!lead || !lead.propertyDetail) return;
      status = lead.propertyDetail.compaction_report;
      provider = lead.propertyDetail.compaction_report_provider;

      const versionsFound = await QuotationVersion.findAll({
        where: { is_approve: false },
        include: [
          {
            model: Quotation,
            as: "quotation",
            where: { leads_id: leadsId },
            attributes: [],
          },
        ],
      });
      versions = versionsFound.map((v) => ({ quotation_version_id: v.quotation_version_id }));
    }

    if (versions.length === 0) return;

    if (status === "not_available" && provider === "builder") {
      let pli;
      let priceListName = "Base Price";

      if (client && typeof client.query === "function") {
        // Raw SQL for PriceList and PriceListItem
        let plResult = await client.query(
          `SELECT price_list_id, name FROM price_list WHERE (builder_id = $1 OR (company_id = $2 AND $2 IS NOT NULL)) AND name = $3 LIMIT 1`,
          [builderId, companyId || null, "Base Price"]
        );
        let priceListId;
        if (plResult.rowCount === 0) {
          const insertPL = await client.query(
            `INSERT INTO price_list (company_id, builder_id, name, sort_order, is_active, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING price_list_id, name`,
            [companyId || null, builderId, "Base Price", 1, true, userId || null]
          );
          priceListId = insertPL.rows[0].price_list_id;
          priceListName = insertPL.rows[0].name;
        } else {
          priceListId = plResult.rows[0].price_list_id;
          priceListName = plResult.rows[0].name;
        }

        let pliResult = await client.query(
          `SELECT * FROM price_list_item WHERE price_list_id = $1 AND item_description = $2 LIMIT 1`,
          [priceListId, "Compaction Report Charge"]
        );
        if (pliResult.rowCount === 0) {
          const insertPLI = await client.query(
            `INSERT INTO price_list_item (price_list_id, company_id, builder_id, item_description, cost_type, cost, builder_cost, status, created_by, is_system_data, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
            [priceListId, companyId || null, builderId, "Compaction Report Charge", "Fixed", 250.00, 100.00, "active", userId || null, true]
          );
          pli = insertPLI.rows[0];
        } else {
          pli = pliResult.rows[0];
        }

        // Sync items across versions
        for (const v of versions) {
          const checkItem = await client.query(
            `SELECT 1 FROM quotation_version_items WHERE quotation_version_id = $1 AND price_list_item_description = $2`,
            [v.quotation_version_id, "Compaction Report Charge"]
          );
          if (checkItem.rowCount === 0) {
            await client.query(
              `INSERT INTO quotation_version_items (
                quotation_version_id, price_list_id, price_list_name, price_list_item_id, 
                price_list_item_description, price_list_item_short_description, 
                price_list_item_cost_type, price_list_item_cost_type_text, 
                price_list_item_cost_option, price_list_item_cost, 
                price_list_item_builder_cost, price_list_item_sort_order, 
                price_list_item_uom, price_list_item_status, 
                price_list_item_include_by_default, price_list_item_allow_remove_from_quotation, 
                price_list_item_show_in_hl_package, price_list_item_package_only, 
                price_list_item_range_id, price_list_item_dwelling_type_id, 
                price_list_item_is_system_data, price_list_item_created_at, 
                price_list_item_updated_at, quantity, total_price, 
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [
                v.quotation_version_id, pli.price_list_id, priceListName, pli.price_list_item_id,
                pli.item_description, pli.short_description, pli.cost_type, pli.cost_type_text,
                pli.cost_option, pli.cost, pli.builder_cost, pli.sort_order,
                pli.uom, pli.status, pli.include_by_default, pli.allow_remove_from_quotation,
                pli.show_in_hl_package, pli.show_only_in_package, pli.range_id, pli.dwelling_type_id,
                pli.is_system_data, pli.created_at, pli.updated_at, 1, pli.cost
              ]
            );
          }
        }
      } else {
        // Original Sequelize logic
        const { PriceList, PriceListItem, QuotationVersionItem } = db;
        const [priceList] = await PriceList.findOrCreate({
          where: { builder_id: builderId, name: "Base Price" },
          defaults: {
            company_id: companyId || null,
            builder_id: builderId,
            name: "Base Price",
            sort_order: 1,
            is_active: true,
            created_by: userId || null,
          },
        });

        const [pliRecord] = await PriceListItem.findOrCreate({
          where: {
            price_list_id: priceList.price_list_id,
            item_description: "Compaction Report Charge",
          },
          defaults: {
            price_list_id: priceList.price_list_id,
            company_id: companyId || null,
            builder_id: builderId,
            item_description: "Compaction Report Charge",
            cost_type: "Fixed",
            cost: 250.00,
            builder_cost: 100.00,
            status: "active",
            created_by: userId || null,
            is_system_data: true,
          },
        });

        pli = pliRecord.get({ plain: true });

        for (const version of versions) {
          await QuotationVersionItem.findOrCreate({
            where: {
              quotation_version_id: version.quotation_version_id,
              price_list_item_description: "Compaction Report Charge",
            },
            defaults: {
              quotation_version_id: version.quotation_version_id,
              price_list_id: pli.price_list_id,
              price_list_name: priceList.name,
              price_list_item_id: pli.price_list_item_id,
              price_list_item_description: pli.item_description,
              price_list_item_short_description: pli.short_description,
              price_list_item_cost_type: pli.cost_type,
              price_list_item_cost_type_text: pli.cost_type_text,
              price_list_item_cost_option: pli.cost_option,
              price_list_item_cost: pli.cost,
              price_list_item_builder_cost: pli.builder_cost,
              price_list_item_sort_order: pli.sort_order,
              price_list_item_uom: pli.uom,
              price_list_item_status: pli.status,
              price_list_item_include_by_default: pli.include_by_default,
              price_list_item_allow_remove_from_quotation: pli.allow_remove_from_quotation,
              price_list_item_show_in_hl_package: pli.show_in_hl_package,
              price_list_item_package_only: pli.show_only_in_package,
              price_list_item_range_id: pli.range_id,
              price_list_item_dwelling_type_id: pli.dwelling_type_id,
              price_list_item_is_system_data: pli.is_system_data,
              price_list_item_created_at: pli.createdAt,
              price_list_item_updated_at: pli.updatedAt,
              quantity: 1,
              total_price: pli.cost,
            },
          });
        }
      }
    } else if (status === "available") {
      if (client && typeof client.query === "function") {
        await client.query(
          `DELETE FROM quotation_version_items 
           WHERE quotation_version_id = ANY($1) 
           AND price_list_item_description = $2`,
          [versions.map((v) => v.quotation_version_id), "Compaction Report Charge"]
        );
      } else {
        const { QuotationVersionItem } = db;
        await QuotationVersionItem.destroy({
          where: {
            quotation_version_id: versions.map((v) => v.quotation_version_id),
            price_list_item_description: "Compaction Report Charge",
          },
        });
      }
    }
  } catch (error) {
    console.error("Error in syncCompactionReportCharge helper:", error);
    throw error;
  }
};

/**
 * Checks if a quotation is locked (i.e., any of its versions are approved).
 * 
 * @param {string} [quotationId] - The UUID of the quotation.
 * @param {string} [versionId] - The UUID of a quotation version.
 * @throws {Error} If the quotation is locked.
 */
export const checkQuotationLockStatus = async (quotationId, versionId) => {
  const { QuotationVersion } = db;
  let qId = quotationId;

  if (!qId && versionId) {
    const version = await QuotationVersion.findByPk(versionId, {
      attributes: ["quotation_id"],
    });
    if (version) {
      qId = version.quotation_id;
    }
  }

  if (!qId) return;

  const approvedVersion = await QuotationVersion.findOne({
    where: {
      quotation_id: qId,
      is_approve: true,
    },
    attributes: ["quotation_version_id"],
  });

  if (approvedVersion) {
    const error = new Error("This action cannot be performed because a version of this quotation has already been approved.");
    error.status = 400;
    throw error;
  }
};

/**
 * Checks if a lead's property details are locked (i.e., any associated quotation is approved).
 * 
 * @param {string} leadsId - The UUID of the lead.
 * @throws {Error} If the lead is locked.
 */
export const checkLeadQuotationLockStatus = async (leadsId) => {
  if (!leadsId) return;

  const { QuotationVersion, Quotation } = db;

  const approvedVersion = await QuotationVersion.findOne({
    include: [
      {
        model: Quotation,
        as: "quotation",
        where: { leads_id: leadsId },
        attributes: [],
      },
    ],
    where: {
      is_approve: true,
    },
    attributes: ["quotation_version_id"],
  });

  if (approvedVersion) {
    const error = new Error("This action cannot be performed because an associated quotation has already been approved.");
    error.status = 400;
    throw error;
  }
};
