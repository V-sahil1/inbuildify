import { Model, DataTypes } from "sequelize";

export class Actions extends Model {
  static associate(models) {
    Actions.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Actions.belongsTo(models.Leads, { foreignKey: "lead_id", as: "lead" });
    Actions.belongsTo(models.Users, { foreignKey: "created_by_id", as: "createdByUser" });
    Actions.belongsTo(models.Users, { foreignKey: "updated_by_id", as: "updatedByUser" });
  }
}
export default (sequelize) => {
  Actions.init({
    action_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { type: DataTypes.ENUM("NOTES","SMS","APPOINTMENT","TASK"), allowNull: false },
    builder_id: { type: DataTypes.UUID, allowNull: false },
    lead_id: { type: DataTypes.UUID, allowNull: false },
    created_by_id: { type: DataTypes.UUID, allowNull: false },
    updated_by_id: { type: DataTypes.UUID, allowNull: false },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "actions", modelName: "Actions", underscored: true });
  return Actions;
};