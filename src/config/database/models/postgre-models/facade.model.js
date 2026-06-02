import { Model, DataTypes } from "sequelize";
import { env } from "../../../env.config.js";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val) => typeof val === "string" && uuidRegex.test(val);

export class Facade extends Model {
  static associate(models) {
    Facade.belongsTo(models.Company, { foreignKey: "company_id", as: "company", onDelete: "CASCADE" });
    Facade.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder", onDelete: "CASCADE" });
    Facade.belongsTo(models.DwellingType, { foreignKey: "dwelling_type_id", as: "dwellingType", onDelete: "SET NULL" });
    Facade.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser", onDelete: "SET NULL" });
    Facade.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser", onDelete: "SET NULL" });
    Facade.hasMany(models.FloorPlanFacadeMap, { foreignKey: "facade_id", as: "floorPlanMaps" });
    Facade.belongsTo(models.Location, { foreignKey: "location_id", as: "location", onDelete: "SET NULL" });
    Facade.belongsTo(models.Range, { foreignKey: "range_id", as: "range", onDelete: "SET NULL" });
    Facade.belongsTo(models.DriveFile, { foreignKey: "image", as: "facadeImageFile", onDelete: "SET NULL" });
  }
}

export default (sequelize) => {
  Facade.init(
    {
      facade_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      location_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      dwelling_type_id: { type: DataTypes.UUID, allowNull: true },
      range_id: { type: DataTypes.UUID, allowNull: true },
      cost_type: { type: DataTypes.STRING(20), defaultValue: "standard" },
      cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      builder_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      image: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      best_faced: { type: DataTypes.BOOLEAN, defaultValue: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "facade", modelName: "Facade", underscored: true },
  );

  // Hook to resolve image UUIDs to absolute S3 URLs on-the-fly
  Facade.addHook("afterFind", async (results, options) => {
    if (!results) {
      return;
    }

    const { DriveFile } = sequelize.models;
    const s3BaseUrl = `https://${env.AWS.S3_BUCKET_NAME}.s3.amazonaws.com`;
    const instances = Array.isArray(results) ? results : [results];

    // Collect UUIDs to run a single batch query for optimal performance
    const fileIds = [];
    instances.forEach((inst) => {
      if (inst && isUuid(inst.image)) {
        fileIds.push(inst.image);
      }
    });

    if (fileIds.length > 0 && DriveFile) {
      const driveFiles = await DriveFile.findAll({
        transaction: options?.transaction,
        where: { file_id: fileIds },
        attributes: ["file_id", "s3_key"],
      });

      const fileMap = new Map(driveFiles.map(f => [f.file_id, f.s3_key]));

      instances.forEach((inst) => {
        if (inst && isUuid(inst.image)) {
          const s3Key = fileMap.get(inst.image);
          if (s3Key) {
            inst.image = `${s3BaseUrl}/${s3Key}`;
          } else {
            inst.image = null;
          }
        }
      });
    }
  });

  return Facade;
};
