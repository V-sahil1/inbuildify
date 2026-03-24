import { Model, DataTypes } from "sequelize";

export class LeadSource extends Model {
  static associate(models) {
    LeadSource.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    LeadSource.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    LeadSource.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    LeadSource.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    LeadSource.hasMany(models.Leads, { foreignKey: "lead_source_id", as: "leads" });
  }
}

export default (sequelize) => {
  LeadSource.init(
    {
      lead_source_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      allow_change: { type: DataTypes.BOOLEAN, defaultValue: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "lead_source", modelName: "LeadSource", underscored: true }
  );
  return LeadSource;
};