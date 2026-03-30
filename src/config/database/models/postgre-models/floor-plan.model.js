import { Model, DataTypes } from "sequelize";

export class FloorPlan extends Model {
  static associate(models) {
    FloorPlan.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    FloorPlan.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    FloorPlan.belongsTo(models.DwellingType, { foreignKey: "dwelling_type_id", as: "dwellingType" });
    FloorPlan.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    FloorPlan.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    FloorPlan.hasMany(models.FloorPlanFacadeMap, { foreignKey: "floor_plan_id", as: "facadeMaps" });
    FloorPlan.hasMany(models.FloorPlanPricelistItemMap, { foreignKey: "floor_plan_id", as: "pricelistItemMaps" });
  }
}

export default (sequelize) => {
  FloorPlan.init(
    {
      floor_plan_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      min_land_width: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      min_land_depth: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      dwelling_area: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      dwelling_type_id: { type: DataTypes.UUID, allowNull: true },
      beds: { type: DataTypes.INTEGER, allowNull: true },
      baths: { type: DataTypes.INTEGER, allowNull: true },
      carpark: { type: DataTypes.INTEGER, allowNull: true },
      living: { type: DataTypes.INTEGER, allowNull: true },
      range_id: { type: DataTypes.UUID, allowNull: true },
      garage_area: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      porch_area: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      alfresco_area: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      total_area: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      detailed_image: { type: DataTypes.STRING(500), allowNull: true },
      simple_image: { type: DataTypes.STRING(500), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      location_id: { type: DataTypes.UUID, allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "floor_plan", modelName: "FloorPlan", underscored: true }
  );
  return FloorPlan;
};
