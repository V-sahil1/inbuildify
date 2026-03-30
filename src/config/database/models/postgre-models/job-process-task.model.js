import { Model, DataTypes } from "sequelize";

export class JobProcessTask extends Model {
  static associate(models) {
    JobProcessTask.belongsTo(models.JobProcessSubStage, { foreignKey: "sub_stage_id", as: "subStage" });
    JobProcessTask.belongsTo(models.Users, { foreignKey: "assignee_id", as: "assignee" });
    JobProcessTask.hasMany(models.JobProcessSubtask, { foreignKey: "job_process_task_id", as: "subtasks" });
  }
}

export default (sequelize) => {
  JobProcessTask.init(
    {
      job_process_task_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      sub_stage_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false },
      folder_id: { type: DataTypes.UUID, allowNull: true },
      no_of_days: { type: DataTypes.INTEGER, allowNull: true },
      assignee_id: { type: DataTypes.UUID, allowNull: true },
      notify: { type: DataTypes.BOOLEAN, defaultValue: false },
      milestone: { type: DataTypes.BOOLEAN, defaultValue: false },
      attachment_mandatory: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_process_task", modelName: "JobProcessTask", underscored: true }
  );
  return JobProcessTask;
};
