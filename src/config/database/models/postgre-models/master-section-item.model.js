import { Model, DataTypes } from "sequelize";

export class MasterSectionItem extends Model {
  static associate(models) {
    MasterSectionItem.belongsTo(models.MasterSectionHeader, { foreignKey: "master_section_header_id", as: "masterSectionHeader" });
  }
}

export default (sequelize) => {
  MasterSectionItem.init(
    {
      master_section_item_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      master_section_header_id: { type: DataTypes.UUID, allowNull: true },
      item_name: { type: DataTypes.STRING(2000), allowNull: false },
      effective_start_date: { type: DataTypes.DATEONLY, allowNull: true },
      effective_end_date: { type: DataTypes.DATEONLY, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "master_section_item", modelName: "MasterSectionItem", underscored: true }
  );
  return MasterSectionItem;
};