import { Model, DataTypes } from "sequelize";

export class Job extends Model {
  static associate(models) {
    Job.belongsTo(models.Opportunity, { foreignKey: "opportunity_id", as: "opportunity" });
    Job.belongsTo(models.QuotationVersion, { foreignKey: "quotation_version_id", as: "quotationVersion" });
  }
}

export default (sequelize) => {
  Job.init(
    {
      job_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      reference_number: { type: DataTypes.STRING(30), allowNull: false },
      opportunity_id: { type: DataTypes.UUID, allowNull: true },
      quotation_version_id: { type: DataTypes.UUID, allowNull: true },
      job_note: { type: DataTypes.STRING(1000), allowNull: true },
      send_email: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job", modelName: "Job", underscored: true }
  );
  return Job;
};
