import { Model, DataTypes } from "sequelize";

export class MaintenanceArea extends Model {
  static associate(models) {
    MaintenanceArea.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    MaintenanceArea.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    MaintenanceArea.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    MaintenanceArea.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  MaintenanceArea.init(
    {
      maintenance_area_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "maintenance_area", modelName: "MaintenanceArea", underscored: true }
  );
  return MaintenanceArea;
};