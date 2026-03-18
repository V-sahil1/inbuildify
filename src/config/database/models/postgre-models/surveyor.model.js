import { Model, DataTypes } from "sequelize";

export class Surveyor extends Model {
  static associate(models) {
    Surveyor.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Surveyor.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Surveyor.belongsTo(models.State, { foreignKey: "state_id", as: "state" });
  }
}

export default (sequelize) => {
  Surveyor.init(
    {
      surveyor_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: false },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      email: { type: DataTypes.STRING(150), allowNull: true },
      phone: { type: DataTypes.STRING(50), allowNull: true },
      abn_number: { type: DataTypes.STRING(20), allowNull: true },
      registration_number: { type: DataTypes.STRING(100), allowNull: true },
      address1: { type: DataTypes.STRING(255), allowNull: false },
      address2: { type: DataTypes.STRING(255), allowNull: true },
      city: { type: DataTypes.STRING(150), allowNull: false },
      state_id: { type: DataTypes.UUID, allowNull: true },
      zip_postal_code: { type: DataTypes.STRING(20), allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "surveyor", modelName: "Surveyor", underscored: true }
  );
  return Surveyor;
};