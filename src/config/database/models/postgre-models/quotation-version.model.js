import { Model, DataTypes } from "sequelize";

export class QuotationVersion extends Model {
  static associate(models) {
    QuotationVersion.belongsTo(models.Quotation, { foreignKey: "quotation_id", as: "quotation", onDelete: "CASCADE" });
    QuotationVersion.belongsTo(models.FloorPlan, { foreignKey: "floor_plan_id", as: "floorPlan", onDelete: "SET NULL" });
    QuotationVersion.belongsTo(models.Facade, { foreignKey: "facade_id", as: "facade", onDelete: "SET NULL" });
    QuotationVersion.hasMany(models.Job, { foreignKey: "quotation_version_id", as: "jobs" });
    QuotationVersion.hasMany(models.QuotationVersionPricelistItemMap, { foreignKey: "quotation_version_id", as: "pricelistItemMaps" });
    QuotationVersion.hasMany(models.QuotationVersionCustomSection, { foreignKey: "quotation_version_id", as: "customSections" });
    QuotationVersion.hasMany(models.QuotationVersionPackageMap, { foreignKey: "quotation_version_id", as: "packageMaps" });
    QuotationVersion.belongsTo(models.StructureEngineer, { foreignKey: "structure_engineer_id", as: "structureEngineer" });
  }
}

export default (sequelize) => {
  QuotationVersion.init(
    {
      quotation_version_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      quotation_id: { type: DataTypes.UUID, allowNull: true },
      quotation_version_no: { type: DataTypes.INTEGER, allowNull: true },
      location_id: { type: DataTypes.UUID, allowNull: true },
      range_id: { type: DataTypes.UUID, allowNull: true },
      dwelling_type_id: { type: DataTypes.UUID, allowNull: true },
      floor_plan_id: { type: DataTypes.UUID, allowNull: true },
      facade_id: { type: DataTypes.UUID, allowNull: true },
      is_approve: { type: DataTypes.BOOLEAN, defaultValue: false },
      sketch_number: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      package_id: { type: DataTypes.UUID, allowNull: true },
      structure_engineer_id: { type: DataTypes.UUID, allowNull: true },
      structure_engineer_price: { type: DataTypes.INTEGER, allowNull: true },
      facade_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      pdf_url: { type: DataTypes.TEXT, allowNull: true },
      esign_status: { type: DataTypes.ENUM('pending', 'sent', 'signed', 'completed', 'declined', 'voided'), allowNull: true, defaultValue: null },
      esign_envelope_id: { type: DataTypes.UUID, allowNull: true },
      signed_pdf_url: { type: DataTypes.TEXT, allowNull: true },
      upload_report: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "quotation_version", modelName: "QuotationVersion", underscored: true }
  );
  return QuotationVersion;
};
