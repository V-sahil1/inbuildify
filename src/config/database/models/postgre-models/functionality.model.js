import { Model, DataTypes } from "sequelize";

export class Functionality extends Model {
  static associate(models) {
    Functionality.hasMany(models.Checklist, { foreignKey: "functionality_id", as: "checklists" });
  }
}

export default (sequelize) => {
  Functionality.init(
    {
      functionality_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      screen_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "functionality", modelName: "Functionality", underscored: true }
  );
  return Functionality;
};