import { Model, DataTypes } from "sequelize";

export class FloorPlanFacadeMap extends Model {
  static associate(models) {
    FloorPlanFacadeMap.belongsTo(models.FloorPlan, { foreignKey: "floor_plan_id", as: "floorPlan" });
    FloorPlanFacadeMap.belongsTo(models.Facade, { foreignKey: "facade_id", as: "facade" });
  }
}

export default (sequelize) => {
  FloorPlanFacadeMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      floor_plan_id: { type: DataTypes.UUID, allowNull: true },
      facade_id: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "floor_plan_facade_map", modelName: "FloorPlanFacadeMap", underscored: true }
  );
  return FloorPlanFacadeMap;
};