import { Model, DataTypes } from "sequelize";

export class Location extends Model {
  static associate(models) {
    Location.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Location.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Location.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Location.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  Location.init(
    {
      location_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "location", modelName: "Location", underscored: true }
  );
  return Location;
};
