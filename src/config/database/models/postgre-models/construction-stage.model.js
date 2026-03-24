import { Model, DataTypes } from "sequelize";

export class ConstructionStage extends Model {
  static associate(models) {
    ConstructionStage.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    ConstructionStage.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builderRef" });
    ConstructionStage.belongsTo(models.ConstructionType, { foreignKey: "construction_type_id", as: "constructionType" });
    ConstructionStage.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    ConstructionStage.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}
export default (sequelize) => {
  ConstructionStage.init({
    construction_stage: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    company_id: { type: DataTypes.UUID, allowNull: true },
    builder_id: { type: DataTypes.UUID, allowNull: true },
    builder: { type: DataTypes.UUID, allowNull: true },
    construction_type_id: { type: DataTypes.UUID, allowNull: true },
    stage_name: { type: DataTypes.STRING(255), allowNull: false },
    days: { type: DataTypes.INTEGER, defaultValue: 10 },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
    site_image: { type: DataTypes.BOOLEAN, defaultValue: false },
    inspection: { type: DataTypes.STRING(100), defaultValue: "not_required" },
    bg_color: { type: DataTypes.STRING(50), allowNull: true },
    font_color: { type: DataTypes.STRING(50), allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "construction_stage", modelName: "ConstructionStage", underscored: true });
  return ConstructionStage;
};