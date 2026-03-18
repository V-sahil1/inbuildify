import { Model, DataTypes } from "sequelize";

export class QuotationVersionPackageMap extends Model {
  static associate(models) {
    QuotationVersionPackageMap.belongsTo(models.QuotationVersion, { foreignKey: "quotation_version_id", as: "quotationVersion" });
    QuotationVersionPackageMap.belongsTo(models.Package, { foreignKey: "package_id", as: "package" });
  }
}

export default (sequelize) => {
  QuotationVersionPackageMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      quotation_version_id: { type: DataTypes.UUID, allowNull: true },
      package_id: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "quotation_version_package_map", modelName: "QuotationVersionPackageMap", underscored: true }
  );
  return QuotationVersionPackageMap;
};