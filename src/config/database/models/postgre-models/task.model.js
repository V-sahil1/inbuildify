import { Model, DataTypes } from "sequelize";

export class Task extends Model {
  static associate(models) {
    Task.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Task.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Task.belongsTo(models.Users, { foreignKey: "assignee_id", as: "assignee" });
    Task.belongsTo(models.Users, { foreignKey: "link_to", as: "linkedUser" });
    Task.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Task.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}
export default (sequelize) => {
  Task.init({
    task_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
    company_id: { type: DataTypes.UUID, allowNull: true },
    builder_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    due_time: { type: DataTypes.TIME, allowNull: true },
    assignee_id: { type: DataTypes.UUID, allowNull: true },
    link_to: { type: DataTypes.UUID, allowNull: true },
    link_type: { type: DataTypes.STRING(255), allowNull: true },
    priority: { type: DataTypes.STRING(20), defaultValue: "Medium" },
    status: { type: DataTypes.STRING(20), defaultValue: "Yet to Start" },
    attach_files: { type: DataTypes.STRING(500), allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "task", modelName: "Task", underscored: true });
  return Task;
};
