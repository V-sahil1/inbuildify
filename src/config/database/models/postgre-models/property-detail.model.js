import { Model, DataTypes } from "sequelize";

export class PropertyDetail extends Model {
  static associate(models) {
    PropertyDetail.belongsTo(models.Lot, { foreignKey: "lot_id", as: "lot", onDelete: "SET NULL" });
    PropertyDetail.belongsTo(models.State, { foreignKey: "state_id", as: "state", onDelete: "SET NULL" });
    PropertyDetail.belongsTo(models.Country, { foreignKey: "country_id", as: "country", onDelete: "SET NULL" });
    PropertyDetail.belongsTo(models.Estate, { foreignKey: "estate_id", as: "estate", onDelete: "CASCADE" });
    PropertyDetail.belongsTo(models.EstateStages, { foreignKey: "estate_stage_id", as: "estateStage", onDelete: "CASCADE" });
    PropertyDetail.hasMany(models.Leads, { foreignKey: "property_detail_id", as: "leads" });
  }
}

export default (sequelize) => {
  PropertyDetail.init(
    {
      property_detail_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      lot_id: { type: DataTypes.UUID, allowNull: true },
      lot_number: { type: DataTypes.STRING(255), allowNull: true },
      street: { type: DataTypes.STRING(255), allowNull: true },
      address_line1: { type: DataTypes.STRING(255), allowNull: true },
      address_line2: { type: DataTypes.STRING(255), allowNull: true },
      city: { type: DataTypes.STRING(255), allowNull: true },
      state_id: { type: DataTypes.UUID, allowNull: true },
      country_id: { type: DataTypes.UUID, allowNull: true },
      zip_code: { type: DataTypes.STRING(10), allowNull: true },
      estate_id: { type: DataTypes.UUID, allowNull: true },
      estate_stage_id: { type: DataTypes.UUID, allowNull: true },
      estate_name: { type: DataTypes.STRING(255), allowNull: true },
      title_status: { type: DataTypes.STRING(255), allowNull: true },
      title_date: { type: DataTypes.DATEONLY, allowNull: true },
      clearing_date: { type: DataTypes.DATEONLY, allowNull: true },
      compaction_report: { type: DataTypes.STRING(255), allowNull: true },
      compaction_report_url: { type: DataTypes.STRING(500), allowNull: true },
      compaction_report_content: { type: DataTypes.JSONB, allowNull: true },
      land_type: { type: DataTypes.STRING(255), allowNull: true },
      width_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      depth_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      total_size_m2: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      site_fall_mm: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      land_fill_mm: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      bush_fire: { type: DataTypes.BOOLEAN, allowNull: true },
      corner_block: { type: DataTypes.BOOLEAN, allowNull: true },
      is_hl_package_lot: { type: DataTypes.BOOLEAN, allowNull: true },
      compaction_report_provider: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "property_detail", modelName: "PropertyDetail", underscored: true },
  );
  return PropertyDetail;
};
