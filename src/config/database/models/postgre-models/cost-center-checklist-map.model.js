import { Model, DataTypes } from "sequelize";

export class CostCenterChecklistMap extends Model {
  static associate(models) {
    CostCenterChecklistMap.belongsTo(models.CostCenter, { foreignKey: "cost_center_id", as: "costCenter" });
    CostCenterChecklistMap.belongsTo(models.ConstructionChecklist, { foreignKey: "construction_checklist_id", as: "constructionChecklist" });
  }
}
export default (sequelize) => {
  CostCenterChecklistMap.init({
    id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
    cost_center_id: { type: DataTypes.UUID, allowNull: false },
    construction_checklist_id: { type: DataTypes.UUID, allowNull: false },
    createdAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "cost_center_checklist_map", modelName: "CostCenterChecklistMap", underscored: true, updatedAt: false });
  return CostCenterChecklistMap;
};
