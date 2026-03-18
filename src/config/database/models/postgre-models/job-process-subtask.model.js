import { Model, DataTypes } from "sequelize";

export class JobProcessSubtask extends Model {
  static associate(models) {
    JobProcessSubtask.belongsTo(models.JobProcessTask, { foreignKey: "job_process_task_id", as: "jobProcessTask" });
  }
}

export default (sequelize) => {
  JobProcessSubtask.init(
    {
      job_process_subtask_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      job_process_task_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_process_subtask", modelName: "JobProcessSubtask", underscored: true }
  );
  return JobProcessSubtask;
};