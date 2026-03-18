import { Model, DataTypes } from "sequelize";

export class ColorGroup extends Model {
  static associate(models) {
    ColorGroup.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    ColorGroup.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    ColorGroup.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    ColorGroup.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    ColorGroup.hasMany(models.ColorGroupItemMap, { foreignKey: "color_group_id", as: "colorGroupItemMaps" });
  }
}

export default (sequelize) => {
  ColorGroup.init(
    {
      color_group_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      builder_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      tableName: "color_group",
      modelName: "ColorGroup",
      underscored: true,
    }
  );

  return ColorGroup;
};