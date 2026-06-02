import { Model, DataTypes, Op } from "sequelize";

export class DriveFile extends Model {
  static associate(models) {
    DriveFile.belongsTo(models.Drive, { foreignKey: "folder_id", as: "folder", onDelete: "CASCADE" });
    DriveFile.belongsTo(models.Company, { foreignKey: "company_id", as: "company", onDelete: "CASCADE" });
    DriveFile.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder", onDelete: "CASCADE" });
    DriveFile.belongsTo(models.Users, { foreignKey: "uploaded_by", as: "uploadedByUser", onDelete: "SET NULL" });
    DriveFile.belongsTo(models.Leads, { foreignKey: "lead_id", as: "lead", onDelete: "CASCADE" });
    DriveFile.hasMany(models.DriveFileVersion, { foreignKey: "file_id", as: "versions" });
  }
}

export default (sequelize) => {
  DriveFile.init(
    {
      file_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      folder_id: { type: DataTypes.UUID, allowNull: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      uploaded_by: { type: DataTypes.UUID, allowNull: true },
      lead_id: { type: DataTypes.UUID, allowNull: true },
      reference_id: { type: DataTypes.UUID, allowNull: true },
      reference_type: { type: DataTypes.STRING, allowNull: true },
      sub_reference_id: { type: DataTypes.UUID, allowNull: true },
      sub_reference_type: { type: DataTypes.STRING, allowNull: true },
      original_name: { type: DataTypes.STRING, allowNull: false },
      file_name: { type: DataTypes.STRING, allowNull: false, unique: true },
      s3_key: { type: DataTypes.STRING, allowNull: false },
      file_extension: { type: DataTypes.STRING, allowNull: true },
      mime_type: { type: DataTypes.STRING, allowNull: true },
      size: { type: DataTypes.BIGINT, allowNull: true },
      is_starred: { type: DataTypes.BOOLEAN, defaultValue: false },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
      thumbnail_s3_key: { type: DataTypes.STRING, allowNull: true },
      thumbnail_status: { type: DataTypes.STRING, allowNull: true, defaultValue: "pending" },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
      deleted_at: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "drive_files",
      modelName: "DriveFile",
      underscored: true,
      paranoid: true,
      indexes: [
        { fields: ["company_id"] },
        { fields: ["folder_id"] },
        { fields: ["deleted_at"] },
        // Guarantees a single active (deleted_at IS NULL) DriveFile per
        // polymorphic reference. Mirrors the partial unique index created in
        // migration 20260523120000. Partial on deleted_at so soft-deleted rows
        // never collide with a new active row for the same reference.
        {
          name: "drive_files_polymorphic_active_unique",
          unique: true,
          fields: ["reference_id", "reference_type", "sub_reference_type"],
          where: {
            deleted_at: null,
            reference_id: { [Op.ne]: null },
            reference_type: { [Op.ne]: null },
            sub_reference_type: { [Op.ne]: null },
          },
        },
      ],
    },
  );
  return DriveFile;
};
