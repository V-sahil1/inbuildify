import { Model, DataTypes } from "sequelize";

export class JobProcessSubStage extends Model {
  static associate(models) {
    JobProcessSubStage.belongsTo(models.JobProcessStage, { foreignKey: "stage_id", as: "stage" });
    JobProcessSubStage.hasMany(models.JobProcessTask, { foreignKey: "sub_stage_id", as: "tasks" });
  }
}

export default (sequelize) => {
  JobProcessSubStage.init(
    {
      sub_stage_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      stage_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_process_sub_stage", modelName: "JobProcessSubStage", underscored: true }
  );
  return JobProcessSubStage;
};
