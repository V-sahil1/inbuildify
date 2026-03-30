import { Model, DataTypes } from "sequelize";

export class MasterSectionHeader extends Model {
  static associate(models) {
    MasterSectionHeader.belongsTo(models.MasterSection, { foreignKey: "master_section", as: "masterSection" });
    MasterSectionHeader.hasMany(models.MasterSectionItem, { foreignKey: "master_section_header_id", as: "items" });
  }
}

export default (sequelize) => {
  MasterSectionHeader.init(
    {
      master_section_header_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      master_section: { type: DataTypes.UUID, allowNull: true },
      heading_name: { type: DataTypes.STRING(255), allowNull: false },
      effective_start_date: { type: DataTypes.DATEONLY, allowNull: true },
      effective_end_date: { type: DataTypes.DATEONLY, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "master_section_header", modelName: "MasterSectionHeader", underscored: true }
  );
  return MasterSectionHeader;
};
