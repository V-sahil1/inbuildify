import { Model, DataTypes } from "sequelize";

export class EstateDocuments extends Model {
  static associate(models) {
    EstateDocuments.belongsTo(models.Estate, { foreignKey: "estate_id", as: "estate" });
    EstateDocuments.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    EstateDocuments.belongsTo(models.Users, { foreignKey: "uploaded_by", as: "uploadedByUser" });
  }
}

export default (sequelize) => {
  EstateDocuments.init(
    {
      estate_document_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      estate_id: { type: DataTypes.UUID, allowNull: true },
      document_name: { type: DataTypes.STRING(255), allowNull: true },
      file_url: { type: DataTypes.STRING(500), allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      uploaded_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "estate_documents", modelName: "EstateDocuments", underscored: true }
  );
  return EstateDocuments;
};