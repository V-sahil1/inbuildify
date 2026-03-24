import { Model, DataTypes } from "sequelize";

export class SupplierType extends Model {
  static associate(models) {
    SupplierType.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    SupplierType.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    SupplierType.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    SupplierType.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    SupplierType.hasMany(models.SupplierSupplierTypeMap, { foreignKey: "supplier_type_id", as: "supplierMaps" });
    SupplierType.hasMany(models.SupplierTypeConstructionChecklistMap, { foreignKey: "supplier_type_id", as: "checklistMaps" });
  }
}

export default (sequelize) => {
  SupplierType.init(
    {
      supplier_type_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "supplier_type", modelName: "SupplierType", underscored: true }
  );
  return SupplierType;
};