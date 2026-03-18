import { Model, DataTypes } from "sequelize";

export class ConstructionChecklist extends Model {
  static associate(models) {
    ConstructionChecklist.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    ConstructionChecklist.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builderRef" });
    ConstructionChecklist.belongsTo(models.ComplianceType, { foreignKey: "compliance_type_id", as: "complianceType" });
    ConstructionChecklist.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    ConstructionChecklist.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    ConstructionChecklist.hasMany(models.ConstructionChecklistPredecessor, { foreignKey: "construction_checklist_id", as: "predecessors" });
    ConstructionChecklist.hasMany(models.ConstructionSubChecklist, { foreignKey: "construction_checklist_id", as: "subChecklists" });
    ConstructionChecklist.hasMany(models.CostCenterChecklistMap, { foreignKey: "construction_checklist_id", as: "costCenterMaps" });
  }
}

export default (sequelize) => {
  ConstructionChecklist.init(
    {
      construction_checklist_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      builder: { type: DataTypes.UUID, allowNull: true },
      construction_type_id: { type: DataTypes.UUID, allowNull: true },
      construction_stage_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      supplier_type_id: { type: DataTypes.UUID, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      data_required: { type: DataTypes.BOOLEAN, defaultValue: true },
      supplier: { type: DataTypes.BOOLEAN, defaultValue: true },
      claim: { type: DataTypes.BOOLEAN, defaultValue: false },
      dependent: { type: DataTypes.BOOLEAN, defaultValue: false },
      no_of_days: { type: DataTypes.INTEGER, defaultValue: 1 },
      notify: { type: DataTypes.BOOLEAN, defaultValue: false },
      milestone: { type: DataTypes.BOOLEAN, defaultValue: false },
      attachment_mandatory: { type: DataTypes.BOOLEAN, defaultValue: false },
      attachment_mandatory_name: { type: DataTypes.STRING(255), allowNull: true },
      cost_center_id: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
      construction_option_id: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
      compliance_type_id: { type: DataTypes.UUID, allowNull: true },
      po_folder_id: { type: DataTypes.UUID, allowNull: true },
      job_documents_folder_id: { type: DataTypes.UUID, allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "construction_checklist",
      modelName: "ConstructionChecklist",
      underscored: true,
    }
  );
  return ConstructionChecklist;
};