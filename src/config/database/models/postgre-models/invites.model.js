import { Model, DataTypes } from "sequelize";

export class Invites extends Model {
  static associate(models) {
    Invites.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Invites.belongsTo(models.Role, { foreignKey: "role_id", as: "role" });
  }
}

export default (sequelize) => {
  Invites.init(
    {
      invite_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email: { type: DataTypes.STRING(255), allowNull: false },
      invite_token: { type: DataTypes.TEXT, allowNull: false },
      builder_id: { type: DataTypes.UUID, allowNull: false },
      role_id: { type: DataTypes.UUID, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      invited_at: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "invites", modelName: "Invites", underscored: true }
  );
  return Invites;
};