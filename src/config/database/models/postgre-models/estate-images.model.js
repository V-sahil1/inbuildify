import { Model, DataTypes } from "sequelize";

export class EstateImages extends Model {
  static associate(models) {
    EstateImages.belongsTo(models.Estate, { foreignKey: "estate_id", as: "estate" });
    EstateImages.belongsTo(models.Users, { foreignKey: "uploaded_by", as: "uploadedByUser" });
  }
}

export default (sequelize) => {
  EstateImages.init(
    {
      estate_image_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      estate_id: { type: DataTypes.UUID, allowNull: true },
      image_url: { type: DataTypes.STRING(500), allowNull: true },
      uploaded_by: { type: DataTypes.UUID, allowNull: true },
      uploaded_at: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "estate_images", modelName: "EstateImages", underscored: true }
  );
  return EstateImages;
};