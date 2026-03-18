import { Model, DataTypes } from "sequelize";

export class Checklist extends Model {
  static associate(models) {
    Checklist.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Checklist.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Checklist.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    Checklist.hasMany(models.ChecklistItem, { foreignKey: "checklist_id", as: "checklistItems" });
  }
}

export default (sequelize) => {
  Checklist.init(
    {
      checklist_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      builder_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      screen_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      functionality_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      tableName: "checklist",
      modelName: "Checklist",
      underscored: true,
    }
  );

  return Checklist;
};