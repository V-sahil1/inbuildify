import { Model, DataTypes } from "sequelize";

export class Color extends Model {
  static associate(models) {
    Color.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Color.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Color.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Color.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    Color.hasMany(models.ColorCategory, { foreignKey: "color_id", as: "colorCategories" });
  }
}

export default (sequelize) => {
  Color.init(
    {
      color_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      color_name: { type: DataTypes.STRING(255), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "color", modelName: "Color", underscored: true }
  );
  return Color;
};
