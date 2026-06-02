import { Model, DataTypes } from "sequelize";

export class Drive extends Model {
  static associate(models) {
    Drive.belongsTo(models.Company, { foreignKey: "company_id", as: "company", onDelete: "CASCADE" });
    Drive.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder", onDelete: "CASCADE" });
    Drive.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser", onDelete: "SET NULL" });
    Drive.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser", onDelete: "SET NULL" });
    
    // Self-referencing associations for folder hierarchy
    Drive.belongsTo(models.Drive, { foreignKey: "parent_id", as: "parent", onDelete: "CASCADE" });
    Drive.hasMany(models.Drive, { foreignKey: "parent_id", as: "children" });
    
    // File association
    Drive.hasMany(models.DriveFile, { foreignKey: "folder_id", as: "files" });
  }
}

export default (sequelize) => {
  Drive.init(
    {
      drive_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      is_starred: { type: DataTypes.BOOLEAN, defaultValue: false },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      parent_id: { type: DataTypes.UUID, allowNull: true },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
      deleted_at: { type: DataTypes.DATE },
    },
    { 
      sequelize, 
      tableName: "drive", 
      modelName: "Drive", 
      underscored: true,
      paranoid: true, // Enable soft delete
      indexes: [
        { fields: ['company_id'] },
        { fields: ['parent_id'] },
        { fields: ['deleted_at'] },
      ]
    }
  );
  return Drive;
};
