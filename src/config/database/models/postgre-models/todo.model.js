import { Model, DataTypes } from "sequelize";

export class Todo extends Model {
  static associate(models) {
    Todo.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder", onDelete: "CASCADE" });
    Todo.belongsTo(models.Company, { foreignKey: "company_id", as: "company", onDelete: "CASCADE" });
    Todo.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser", onDelete: "SET NULL" });
    Todo.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser", onDelete: "SET NULL" });
  }
}

export default (sequelize) => {
  Todo.init(
    {
      todo_id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      job_id: { type: DataTypes.UUID, allowNull: true },
      task_name: { type: DataTypes.STRING(255), allowNull: false },
      supplier_id: { type: DataTypes.UUID, allowNull: true },
      booking_date: { type: DataTypes.DATEONLY, allowNull: true },
      start_date: { type: DataTypes.DATEONLY, allowNull: true },
      finish_date: { type: DataTypes.DATEONLY, allowNull: true },
      site_supervisor_id: { type: DataTypes.UUID, allowNull: true },
      subject: { type: DataTypes.STRING(500), allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM("Pending", "Confirmed", "Cancelled"),
        defaultValue: "Pending",
      },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "todo",
      modelName: "Todo",
      underscored: true,
    }
  );
  return Todo;
};
