import db from "../../config/database/models/postgre-models/index.js";

export const deletePriceListService = async (priceListId, companyId, builderId) => {
  const { PriceList } = db;
  const { Op } = db.Sequelize;
  const transaction = await db.sequelize.transaction();

  try {
    const existing = await PriceList.findOne({
      where: {
        price_list_id: priceListId,
        company_id: companyId || null,
        builder_id: builderId || null,
        is_system_data: false,
      },
      transaction,
    });

    if (!existing) {
      throw { status: 404, message: "Record not found or you do not have permission to delete this." };
    }

    const deletedSortOrder = existing.sort_order;

    // Shift sort_order for remaining items
    await PriceList.decrement(
      { sort_order: 1 },
      {
        where: {
          sort_order: { [Op.gt]: deletedSortOrder },
          company_id: companyId || null,
          builder_id: builderId || null,
        },
        transaction,
      },
    );

    // Delete the PriceList
    await existing.destroy({ transaction });

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
