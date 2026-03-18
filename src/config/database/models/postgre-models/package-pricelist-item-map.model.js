import { Model, DataTypes } from "sequelize";

export class PackagePricelistItemMap extends Model {
  static associate(models) {
    PackagePricelistItemMap.belongsTo(models.Package, { foreignKey: "package_id", as: "package" });
    PackagePricelistItemMap.belongsTo(models.PriceListItem, { foreignKey: "price_list_item_id", as: "priceListItem" });
  }
}

export default (sequelize) => {
  PackagePricelistItemMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      package_id: { type: DataTypes.UUID, allowNull: false },
      price_list_item_id: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "package_pricelist_item_map", modelName: "PackagePricelistItemMap", underscored: true }
  );
  return PackagePricelistItemMap;
};