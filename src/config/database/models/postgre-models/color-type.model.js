import { Model, DataTypes } from "sequelize";

export class ColorType extends Model {
  static associate(models) {
    ColorType.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    ColorType.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    ColorType.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    ColorType.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  ColorType.init(
    {
      color_type_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      color_type_name: { type: DataTypes.STRING(255), allowNull: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "color_type",
      modelName: "ColorType",
      underscored: true,
    }
  );
  return ColorType;
};