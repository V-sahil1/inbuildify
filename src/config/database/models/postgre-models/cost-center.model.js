import { Model, DataTypes } from "sequelize";

export class CostCenter extends Model {
  static associate(models) {
    CostCenter.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    CostCenter.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    CostCenter.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    CostCenter.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    CostCenter.hasMany(models.CostCenterChecklistMap, { foreignKey: "cost_center_id", as: "checklistMaps" });
  }
}

export default (sequelize) => {
  CostCenter.init(
    {
      cost_center_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      code: { type: DataTypes.STRING(100), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "cost_center",
      modelName: "CostCenter",
      underscored: true,
    }
  );
  return CostCenter;
};