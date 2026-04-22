import db from "../../config/database/models/postgre-models/index.js";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";

export const createPropertyService = async (leadsId, propertyData, user) => {
  const { Leads, PropertyDetail, State, Country, EstateStages, PriceList, PriceListItem } = db;
  const transaction = await db.sequelize.transaction();

  try {
    const { builder_id: builderId, company_id: companyId, user_id: userId } = user;

    // 1. Authorization check
    if (!builderId && !companyId) {
      throw { status: 401, message: "Unauthorized: User must belong to either a builder or company" };
    }

    // 2. Lead existence and permission check
    const lead = await Leads.findOne({
      where: {
        leads_id: leadsId,
        [db.Sequelize.Op.or]: [
          { company_id: companyId || null },
          { builder_id: builderId || null },
        ],
      },
      transaction,
    });

    if (!lead) {
      throw { status: 400, message: "Invalid lead id." };
    }

    await checkLeadLockStatus(leadsId);

    // 3. Existing property check
    if (lead.property_detail_id) {
      throw { status: 400, message: "Property already exists for this lead. Only one property is allowed per lead." };
    }

    // 4. Compaction report validation
    if (propertyData.compaction_report === "available" && propertyData.compaction_report_provider) {
      throw { status: 400, message: "compactionReportProvider is not allowed when compactionReport is available." };
    }

    if (propertyData.compaction_report === "available") {
      propertyData.compaction_report_provider = null;
    }

    // 5. Create Property Detail
    const newProperty = await PropertyDetail.create(
      {
        ...propertyData,
        land_type: propertyData.land_type || "REGULAR",
        is_hl_package_lot: false,
      },
      { transaction },
    );

    // 6. Link to Lead and update status
    const updateData = {
      property_detail_id: newProperty.property_detail_id,
    };

    if (lead.status === "New") {
      updateData.status = "Working";
    }

    await lead.update(updateData, { transaction });

    // 7. Create Base Price and Compaction Report Charge if compaction_report_provider is 'builder'
    if (propertyData.compaction_report_provider === "builder") {
      // Create or find "Base Price" PriceList
      const [priceList] = await PriceList.findOrCreate({
        where: {
          builder_id: builderId,
          name: "Base Price",
        },
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

      // Create or find default PriceListItem for this PriceList
      await PriceListItem.findOrCreate({
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
    }

    await transaction.commit();

    // 8. Re-fetch enriched
    const enriched = await PropertyDetail.findOne({
      where: { property_detail_id: newProperty.property_detail_id },
      include: [
        { model: State, as: "state", attributes: ["name"] },
        { model: Country, as: "country", attributes: ["name"] },
        { model: EstateStages, as: "estateStage", attributes: ["name"] },
      ],
    });

    // Flatten names and remove nested objects for exact backward compatibility
    const plain = enriched.get({ plain: true });
    const result = {
      ...plain,
      state_name: plain.state?.name || null,
      country_name: plain.country?.name || null,
      estate_stage_name: plain.estateStage?.name || null,
    };

    // Remove the nested objects to match the original flat SQL result
    delete result.state;
    delete result.country;
    delete result.estateStage;

    return result;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};