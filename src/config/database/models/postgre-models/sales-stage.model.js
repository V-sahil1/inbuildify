import { Model, DataTypes } from "sequelize";

export class SalesStage extends Model {
  static associate(models) {
    SalesStage.belongsTo(models.SalesProcess, { foreignKey: "sales_process_id", as: "salesProcess" });
    SalesStage.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    SalesStage.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}
export default (sequelize) => {
  SalesStage.init({
    sales_stage_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sales_process_id: { type: DataTypes.UUID, allowNull: false },
    stage_name: { type: DataTypes.STRING(150), allowNull: false },
    functionality_id: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    category: { type: DataTypes.STRING(50), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "sales_stage", modelName: "SalesStage", underscored: true });
  return SalesStage;
};