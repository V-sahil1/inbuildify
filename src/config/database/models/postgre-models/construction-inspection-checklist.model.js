import { Model, DataTypes } from "sequelize";

export class ConstructionInspectionChecklist extends Model {
  static associate(models) {
    ConstructionInspectionChecklist.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    ConstructionInspectionChecklist.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builderRef" });
    ConstructionInspectionChecklist.belongsTo(models.ConstructionType, { foreignKey: "construction_type_id", as: "constructionType" });
    ConstructionInspectionChecklist.belongsTo(models.ConstructionStage, { foreignKey: "construction_stage_id", as: "constructionStage" });
    ConstructionInspectionChecklist.belongsTo(models.ConstructionOption, { foreignKey: "construction_option_id", as: "constructionOption" });
    ConstructionInspectionChecklist.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    ConstructionInspectionChecklist.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}
export default (sequelize) => {
  ConstructionInspectionChecklist.init({
    construction_inspection_checklist_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    company_id: { type: DataTypes.UUID, allowNull: true },
    builder_id: { type: DataTypes.UUID, allowNull: true },
    builder: { type: DataTypes.UUID, allowNull: true },
    construction_type_id: { type: DataTypes.UUID, allowNull: true },
    construction_stage_id: { type: DataTypes.UUID, allowNull: true },
    field_name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
    construction_option_id: { type: DataTypes.UUID, allowNull: true },
    section_id: { type: DataTypes.UUID, allowNull: true },
    add_all_existing_jobs: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "construction_inspection_checklist", modelName: "ConstructionInspectionChecklist", underscored: true });
  return ConstructionInspectionChecklist;
};