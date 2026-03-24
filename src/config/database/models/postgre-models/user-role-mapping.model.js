import { Model, DataTypes } from "sequelize";

export class UserRoleMapping extends Model {
  static associate(models) {
    UserRoleMapping.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    UserRoleMapping.belongsTo(models.Role, { foreignKey: "role_id", as: "role" });
    UserRoleMapping.belongsTo(models.RoleType, { foreignKey: "role_type_id", as: "roleType" });
    UserRoleMapping.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
  }
}
export default (sequelize) => {
  UserRoleMapping.init({
    user_role_mapping_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    company_id: { type: DataTypes.UUID, allowNull: true },
    builder_id: { type: DataTypes.UUID, allowNull: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    role_id: { type: DataTypes.UUID, allowNull: false },
    role_type_id: { type: DataTypes.UUID, allowNull: true },
    assigned_by: { type: DataTypes.UUID, allowNull: true },
    assigned_at: { type: DataTypes.DATE, allowNull: true },
  }, { sequelize, tableName: "user_role_mapping", modelName: "UserRoleMapping", underscored: true, timestamps: false });
  return UserRoleMapping;
};