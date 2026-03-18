import { Model, DataTypes } from "sequelize";

export class JobProcess extends Model {
  static associate(models) {
    JobProcess.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    JobProcess.hasMany(models.JobProcessStage, { foreignKey: "company_id", as: "stages" });
  }
}

export default (sequelize) => {
  JobProcess.init(
    {
      job_process_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_process", modelName: "JobProcess", underscored: true }
  );
  return JobProcess;
};