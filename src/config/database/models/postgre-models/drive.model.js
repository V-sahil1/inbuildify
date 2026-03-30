import { Model, DataTypes } from "sequelize";

export class Drive extends Model {
  static associate(models) {
    Drive.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Drive.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Drive.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Drive.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  Drive.init(
    {
      drive_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "drive", modelName: "Drive", underscored: true }
  );
  return Drive;
};
