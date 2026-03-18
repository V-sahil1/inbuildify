import { Model, DataTypes } from "sequelize";

export class LotPackage extends Model {
  static associate(models) {
    LotPackage.belongsTo(models.Lot, { foreignKey: "lot_id", as: "lot" });
    LotPackage.belongsTo(models.DwellingType, { foreignKey: "dwelling_type_id", as: "dwellingType" });
    LotPackage.belongsTo(models.FloorPlan, { foreignKey: "floor_plan_id", as: "floorPlan" });
    LotPackage.belongsTo(models.Facade, { foreignKey: "facade_id", as: "facade" });
    LotPackage.belongsTo(models.LotPackageGroup, { foreignKey: "lot_package_group_id", as: "lotPackageGroup" });
    LotPackage.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    LotPackage.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  LotPackage.init(
    {
      lot_package_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      lot_id: { type: DataTypes.UUID, allowNull: true },
      package_name: { type: DataTypes.STRING(255), allowNull: false },
      dwelling_type_id: { type: DataTypes.UUID, allowNull: true },
      range_id: { type: DataTypes.UUID, allowNull: true },
      lot_package_group_id: { type: DataTypes.UUID, allowNull: true },
      disclaimer: { type: DataTypes.STRING(100), allowNull: true },
      floor_plan_id: { type: DataTypes.UUID, allowNull: true },
      facade_id: { type: DataTypes.UUID, allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "lot_package", modelName: "LotPackage", underscored: true }
  );
  return LotPackage;
};