import { Model, DataTypes } from "sequelize";

export class DocumentFileNamingRule extends Model {
  static associate(models) {
    DocumentFileNamingRule.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    DocumentFileNamingRule.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    DocumentFileNamingRule.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    DocumentFileNamingRule.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  DocumentFileNamingRule.init(
    {
      document_file_naming_rule_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      file_type: { type: DataTypes.STRING(150), allowNull: false },
      folder_ids: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "document_file_naming_rule", modelName: "DocumentFileNamingRule", underscored: true }
  );
  return DocumentFileNamingRule;
};