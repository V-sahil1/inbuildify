import { Model, DataTypes } from "sequelize";

export class Notes extends Model {
  static associate(models) {
    Notes.belongsTo(models.Actions, { foreignKey: "action_id", as: "action" });
  }
}

export default (sequelize) => {
  Notes.init(
    {
      notes_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      action_id: { type: DataTypes.UUID, allowNull: false },
      message: { type: DataTypes.STRING(500), allowNull: false },
      tags: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
      attachment: { type: DataTypes.TEXT, allowNull: true },
      task_id: { type: DataTypes.UUID, allowNull: true },
      is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "notes", modelName: "Notes", underscored: true }
  );
  return Notes;
};
