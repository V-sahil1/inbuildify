import { Model, DataTypes } from "sequelize";

export class Role extends Model {
  static associate(models) {
    Role.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Role.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    Role.hasMany(models.RolePermission, { foreignKey: "role_id", as: "permissions" });
    Role.hasMany(models.RoleType, { foreignKey: "role_id", as: "roleTypes" });
    Role.hasMany(models.Users, { foreignKey: "role_id", as: "users" });
    Role.hasMany(models.UserRoleMapping, { foreignKey: "role_id", as: "userRoleMappings" });
  }
}

export default (sequelize) => {
  Role.init(
    {
      role_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "role", modelName: "Role", underscored: true }
  );
  return Role;
};