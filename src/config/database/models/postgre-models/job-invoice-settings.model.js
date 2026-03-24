import { Model, DataTypes } from "sequelize";

export class JobInvoiceSettings extends Model {
  static associate(models) {
    JobInvoiceSettings.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    JobInvoiceSettings.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    JobInvoiceSettings.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    JobInvoiceSettings.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    JobInvoiceSettings.hasMany(models.JobInvoiceStagePayments, { foreignKey: "job_invoice_settings_id", as: "stagePayments" });
  }
}

export default (sequelize) => {
  JobInvoiceSettings.init(
    {
      job_invoice_settings_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      show_invoice_summary_in_pdf: { type: DataTypes.BOOLEAN, defaultValue: false },
      invoice_terms_days: { type: DataTypes.INTEGER, defaultValue: 0 },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_invoice_settings", modelName: "JobInvoiceSettings", underscored: true }
  );
  return JobInvoiceSettings;
};