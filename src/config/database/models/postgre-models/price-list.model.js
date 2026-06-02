import { Model, DataTypes } from "sequelize";

export class PriceList extends Model {
  static associate(models) {
    PriceList.belongsTo(models.Company, { foreignKey: "company_id", as: "company", onDelete: "CASCADE" });
    PriceList.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder", onDelete: "CASCADE" });
    PriceList.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser", onDelete: "SET NULL" });
    PriceList.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser", onDelete: "SET NULL" });
    PriceList.hasMany(models.PriceListItem, { foreignKey: "price_list_id", as: "items" });
  }
}

export default (sequelize) => {
  PriceList.init(
    {
      price_list_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
      show_in_view_list: { type: DataTypes.BOOLEAN, defaultValue: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      location: { type: DataTypes.UUID, allowNull: true },
      is_suggested: { type: DataTypes.BOOLEAN, defaultValue: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },

    },
    { sequelize, tableName: "price_list", modelName: "PriceList", underscored: true },
  );
  return PriceList;
};
