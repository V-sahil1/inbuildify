import { Model, DataTypes } from "sequelize";

export class CustomField extends Model {
  static associate(models) {
    CustomField.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    CustomField.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    CustomField.belongsTo(models.CustomFieldModule, { foreignKey: "module_id", as: "module" });
    CustomField.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    CustomField.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    CustomField.hasMany(models.CustomFieldValue, { foreignKey: "custom_field_id", as: "values" });
  }
}

export default (sequelize) => {
  CustomField.init(
    {
      custom_field_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      module_id: { type: DataTypes.UUID, allowNull: false },
      field_name: { type: DataTypes.STRING(150), allowNull: false },
      field_type: {
        type: DataTypes.ENUM("text", "number", "date", "checkbox", "list", "multiline"),
        allowNull: false,
      },
      options: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "custom_field", modelName: "CustomField", underscored: true }
  );
  return CustomField;
};