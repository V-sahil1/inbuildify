import { Model, DataTypes } from "sequelize";

export class BusinessContact extends Model {
  static associate(models) {
    BusinessContact.belongsTo(models.Country, { foreignKey: "country_id", as: "country" });
    BusinessContact.belongsTo(models.State, { foreignKey: "state_id", as: "state" });
  }
}

export default (sequelize) => {
  BusinessContact.init(
    {
      business_contact_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      leads_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      contact_type: {
        type: DataTypes.ENUM("company", "conveyancer", "mortgage_broker", "financer"),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      address1: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      address2: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      zip_code: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      country_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      state_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      abn_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      acn_number: {
        type: DataTypes.STRING(20),
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
      tableName: "business_contact",
      modelName: "BusinessContact",
      underscored: true,
    }
  );

  return BusinessContact;
};