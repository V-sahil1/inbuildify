import db from "../config/database/models/postgre-models/index.js";

/**
 * Synchronizes the "Compaction Report Charge" across all non-approved quotation versions 
 * of a lead based on the property's compaction report status.
 * 
 * @param {string} leadsId - The UUID of the lead.
 * @param {string} builderId - The UUID of the builder.
 * @param {string} companyId - The UUID of the company.
 * @param {string} userId - The UUID of the user performing the action.
 * @param {object} [transaction] - Optional Sequelize transaction.
 */
export const syncCompactionReportCharge = async (leadsId, builderId, companyId, userId, transaction) => {
  try {
    let status, provider;
    let versions = [];

    // Use Sequelize models
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
      transaction,
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
      transaction,
    });
    versions = versionsFound.map((v) => ({ quotation_version_id: v.quotation_version_id }));

    if (versions.length === 0) return;

    if (status === "not_available" && provider === "builder") {
      let pli;
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
        transaction,
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
        transaction,
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
          transaction,
        });
      }
    } else if (status === "available") {
      const { QuotationVersionItem } = db;
      await QuotationVersionItem.destroy({
        where: {
          quotation_version_id: versions.map((v) => v.quotation_version_id),
          price_list_item_description: "Compaction Report Charge",
        },
        transaction,
      });
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
 * @param {object} [transaction] - Optional Sequelize transaction.
 * @throws {Error} If the quotation is locked.
 */
export const checkQuotationLockStatus = async (quotationId, versionId, transaction = null) => {
  const { QuotationVersion } = db;
  let qId = quotationId;

  if (!qId && versionId) {
    const version = await QuotationVersion.findByPk(versionId, {
      attributes: ["quotation_id"],
      transaction
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
    transaction
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
 * @param {object} [transaction] - Optional Sequelize transaction.
 * @throws {Error} If the lead is locked.
 */
export const checkLeadQuotationLockStatus = async (leadsId, transaction = null) => {
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
    transaction
  });

  if (approvedVersion) {
    const error = new Error("This action cannot be performed because an associated quotation has already been approved.");
    error.status = 400;
    throw error;
  }
};
