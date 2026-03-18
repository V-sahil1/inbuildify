import { Model, DataTypes } from "sequelize";

export class UserPasswordHistory extends Model {
  static associate(models) {
    UserPasswordHistory.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
  }
}

export default (sequelize) => {
  UserPasswordHistory.init(
    {
      history_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      old_password: { type: DataTypes.STRING(255), allowNull: false },
      changed_at: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "user_password_history", modelName: "UserPasswordHistory", underscored: true }
  );
  return UserPasswordHistory;
};