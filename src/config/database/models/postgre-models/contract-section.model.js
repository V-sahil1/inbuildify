import { Model, DataTypes } from "sequelize";

export class ContractSection extends Model {
  static associate(models) {
    ContractSection.belongsTo(models.ContractFormat, { foreignKey: "contract_format_id", as: "contractFormat" });
  }
}

export default (sequelize) => {
  ContractSection.init(
    {
      contract_section_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      contract_format_id: { type: DataTypes.UUID, allowNull: true },
      section_name: { type: DataTypes.STRING(255), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 1 },
      section_url: { type: DataTypes.STRING(500), allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "contract_section",
      modelName: "ContractSection",
      underscored: true,
    }
  );
  return ContractSection;
};