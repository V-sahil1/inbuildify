import { Model, DataTypes } from "sequelize";

export class FloorPlanPricelistItemMap extends Model {
  static associate(models) {
    FloorPlanPricelistItemMap.belongsTo(models.FloorPlan, { foreignKey: "floor_plan_id", as: "floorPlan" });
  }
}

export default (sequelize) => {
  FloorPlanPricelistItemMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      floor_plan_id: { type: DataTypes.UUID, allowNull: true },
      price_list_item_id: { type: DataTypes.UUID, allowNull: true },
      include_default: { type: DataTypes.BOOLEAN, defaultValue: false },
      modify: { type: DataTypes.BOOLEAN, defaultValue: false },
      quantity: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "floor_plan_pricelist_item_map", modelName: "FloorPlanPricelistItemMap", underscored: true }
  );
  return FloorPlanPricelistItemMap;
};