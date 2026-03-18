import { Model, DataTypes } from "sequelize";

export class Facade extends Model {
  static associate(models) {
    Facade.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Facade.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Facade.belongsTo(models.DwellingType, { foreignKey: "dwelling_type_id", as: "dwellingType" });
    Facade.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Facade.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    Facade.hasMany(models.FloorPlanFacadeMap, { foreignKey: "facade_id", as: "floorPlanMaps" });
  }
}

export default (sequelize) => {
  Facade.init(
    {
      facade_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      location_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      dwelling_type_id: { type: DataTypes.UUID, allowNull: true },
      range_id: { type: DataTypes.UUID, allowNull: true },
      cost_type: { type: DataTypes.STRING(20), defaultValue: "standard" },
      cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      builder_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      image: { type: DataTypes.STRING(500), allowNull: true },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "facade", modelName: "Facade", underscored: true }
  );
  return Facade;
};