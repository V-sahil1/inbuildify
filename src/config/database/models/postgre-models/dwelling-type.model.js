import { Model, DataTypes } from "sequelize";

export class DwellingType extends Model {
  static associate(models) {
    DwellingType.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    DwellingType.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    DwellingType.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    DwellingType.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  DwellingType.init(
    {
      dwelling_type_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "dwelling_type", modelName: "DwellingType", underscored: true }
  );
  return DwellingType;
};