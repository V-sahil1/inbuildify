import { Model, DataTypes } from "sequelize";

export class SupplierDocuments extends Model {
  static associate(models) {
    SupplierDocuments.belongsTo(models.Supplier, { foreignKey: "supplier_id", as: "supplier" });
  }
}

export default (sequelize) => {
  SupplierDocuments.init(
    {
      supplier_document_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      supplier_id: { type: DataTypes.UUID, allowNull: false },
      work_cover_url: { type: DataTypes.STRING(500), allowNull: true },
      pl_insurance_url: { type: DataTypes.STRING(500), allowNull: true },
      white_card_url: { type: DataTypes.STRING(500), allowNull: true },
      fork_lift_license_url: { type: DataTypes.STRING(500), allowNull: true },
      trade_license_url: { type: DataTypes.STRING(500), allowNull: true },
      induction_pack_received: { type: DataTypes.BOOLEAN, defaultValue: false },
      induction_pack_url: { type: DataTypes.STRING(500), allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "supplier_documents", modelName: "SupplierDocuments", underscored: true }
  );
  return SupplierDocuments;
};
