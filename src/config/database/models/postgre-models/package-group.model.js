import { Model, DataTypes } from "sequelize";

export class PackageGroup extends Model {
  static associate(models) {
    PackageGroup.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    PackageGroup.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
  }
}

export default (sequelize) => {
  PackageGroup.init(
    {
      package_group_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      no_of_packages: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "package_group", modelName: "PackageGroup", underscored: true }
  );
  return PackageGroup;
};
