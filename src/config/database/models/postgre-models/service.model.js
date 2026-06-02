import { Model, DataTypes } from "sequelize";

export class Service extends Model {
  static associate(models) {
    Service.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
  }
}

export default (sequelize) => {
  Service.init(
    {
      service_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      service: { type: DataTypes.STRING(100), allowNull: false },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      tableName: "service",
      modelName: "Service",
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["service", "builder_id"],
          name: "uq_service_builder",
        },
      ],
    },
  );
  return Service;
};
