import { Model, DataTypes } from "sequelize";

export class SalesProcess extends Model {
  static associate(models) {
    SalesProcess.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    SalesProcess.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    SalesProcess.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    SalesProcess.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    SalesProcess.hasMany(models.SalesStage, { foreignKey: "sales_process_id", as: "stages" });
  }
}

export default (sequelize) => {
  SalesProcess.init(
    {
      sales_process_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "sales_process", modelName: "SalesProcess", underscored: true }
  );
  return SalesProcess;
};
