import { Model, DataTypes } from "sequelize";

export class JobProcessTaskDependency extends Model {
  static associate(models) {
    JobProcessTaskDependency.belongsTo(models.JobProcessTask, { foreignKey: "task_id", as: "task" });
    JobProcessTaskDependency.belongsTo(models.JobProcessTask, { foreignKey: "predecessor_task_id", as: "predecessorTask" });
  }
}

export default (sequelize) => {
  JobProcessTaskDependency.init(
    {
      task_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      predecessor_task_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_process_task_dependency", modelName: "JobProcessTaskDependency", underscored: true }
  );
  return JobProcessTaskDependency;
};