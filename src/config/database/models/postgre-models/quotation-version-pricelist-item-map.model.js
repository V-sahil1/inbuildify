import { Model, DataTypes } from "sequelize";

export class QuotationVersionPricelistItemMap extends Model {
  static associate(models) {
    QuotationVersionPricelistItemMap.belongsTo(models.QuotationVersion, { foreignKey: "quotation_version_id", as: "quotationVersion" });
    QuotationVersionPricelistItemMap.belongsTo(models.PriceListItem, { foreignKey: "price_list_item_id", as: "priceListItem" });
  }
}

export default (sequelize) => {
  QuotationVersionPricelistItemMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      quotation_version_id: { type: DataTypes.UUID, allowNull: true },
      price_list_item_id: { type: DataTypes.UUID, allowNull: true },
      quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      note: { type: DataTypes.STRING(500), allowNull: true },
      total_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "quotation_version_pricelist_item_map", modelName: "QuotationVersionPricelistItemMap", underscored: true }
  );
  return QuotationVersionPricelistItemMap;
};