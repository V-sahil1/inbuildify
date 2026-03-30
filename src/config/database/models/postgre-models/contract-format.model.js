import { Model, DataTypes } from "sequelize";

export class ContractFormat extends Model {
  static associate(models) {
    ContractFormat.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    ContractFormat.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builderRef" }); // ← changed
    ContractFormat.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    ContractFormat.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
    ContractFormat.hasMany(models.ContractSection, { foreignKey: "contract_format_id", as: "contractSections" });
  }
}

export default (sequelize) => {
  ContractFormat.init(
    {
      contract_format_id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      builder: { type: DataTypes.UUID, allowNull: true },
      format_name: { type: DataTypes.STRING(255), allowNull: false },
      default_format: { type: DataTypes.BOOLEAN, defaultValue: true },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "contract_format",
      modelName: "ContractFormat",
      underscored: true,
    }
  );
  return ContractFormat;
};
