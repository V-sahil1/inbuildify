import { Model, DataTypes } from "sequelize";

export class JobProcessStageFunctionality extends Model {
  static associate(models) {
    // No foreign key relationships
  }
}

export default (sequelize) => {
  JobProcessStageFunctionality.init(
    {
      functionality_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      is_workflow: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_process_stage_functionality", modelName: "JobProcessStageFunctionality", underscored: true }
  );
  return JobProcessStageFunctionality;
};