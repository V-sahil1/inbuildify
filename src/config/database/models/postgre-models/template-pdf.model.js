import { Model, DataTypes } from "sequelize";

export class TemplatePdf extends Model {
  static associate(models) {
    TemplatePdf.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    TemplatePdf.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    TemplatePdf.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    TemplatePdf.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  TemplatePdf.init(
    {
      template_pdf_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      template_json: { type: DataTypes.JSONB, allowNull: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "template_pdf", modelName: "TemplatePdf", underscored: true }
  );
  return TemplatePdf;
};