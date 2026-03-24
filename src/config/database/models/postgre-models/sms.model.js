import { Model, DataTypes } from "sequelize";

export class Sms extends Model {
  static associate(models) {
    Sms.belongsTo(models.Actions, { foreignKey: "action_id", as: "action" });
  }
}

export default (sequelize) => {
  Sms.init(
    {
      sms_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      action_id: { type: DataTypes.UUID, allowNull: false },
      recipient: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false },
      message: { type: DataTypes.STRING(500), allowNull: false },
      is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "sms", modelName: "Sms", underscored: true }
  );
  return Sms;
};