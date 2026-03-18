import { Model, DataTypes } from "sequelize";

export class ColorGroupItemMap extends Model {
  static associate(models) {
    ColorGroupItemMap.belongsTo(models.ColorGroup, { foreignKey: "color_group_id", as: "colorGroup" });
    ColorGroupItemMap.belongsTo(models.ColorItem, { foreignKey: "color_item_id", as: "colorItem" });
  }
}

export default (sequelize) => {
  ColorGroupItemMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      color_group_id: { type: DataTypes.UUID, allowNull: true },
      color_item_id: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "color_group_item_map", modelName: "ColorGroupItemMap", underscored: true }
  );
  return ColorGroupItemMap;
};