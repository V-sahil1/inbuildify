import { Model, DataTypes } from "sequelize";

export class EstateFeatures extends Model {
  static associate(models) {
    EstateFeatures.belongsTo(models.Estate, { foreignKey: "estate_id", as: "estate" });
  }
}

export default (sequelize) => {
  EstateFeatures.init(
    {
      estate_feature_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      estate_id: { type: DataTypes.UUID, allowNull: true },
      feature_name: { type: DataTypes.STRING(255), allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "estate_features", modelName: "EstateFeatures", underscored: true }
  );
  return EstateFeatures;
};