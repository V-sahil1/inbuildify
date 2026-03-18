import { Model, DataTypes } from "sequelize";

export class PriceListItemCondition extends Model {
  static associate(models) {
    PriceListItemCondition.belongsTo(models.PriceListItem, { foreignKey: "price_list_item_id", as: "priceListItem" });
  }
}

export default (sequelize) => {
  PriceListItemCondition.init(
    {
      price_list_item_condition_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      price_list_item_id: { type: DataTypes.UUID, allowNull: false },
      condition_name: {
        type: DataTypes.ENUM("site_fall", "land_size", "corner_block", "land_fill"),
        allowNull: true,
      },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      range_start: { type: DataTypes.DOUBLE, allowNull: true },
      range_end: { type: DataTypes.DOUBLE, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "price_list_item_condition", modelName: "PriceListItemCondition", underscored: true }
  );
  return PriceListItemCondition;
};