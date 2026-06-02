import { Model, DataTypes } from "sequelize";

export class FeaturFacade extends Model {
  static associate(models) {
    FeaturFacade.belongsTo(models.Company, { foreignKey: "company_id", as: "company", onDelete: "CASCADE" });
    FeaturFacade.belongsTo(models.Builder, {
      foreignKey: "builder_id",
      as: "builder",
      onDelete: "CASCADE",
    });
    FeaturFacade.belongsTo(models.Facade, {
      foreignKey: "facade_id",
      as: "facade",
      onDelete: "SET NULL",
    });
    FeaturFacade.hasMany(models.FeaturedFacadeLead, { foreignKey: "featur_facade_id", as: "leads" });
  }
}

export default (sequelize) => {
  FeaturFacade.init(
    {
      featur_facade_id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      start_date: { type: DataTypes.DATE, allowNull: true },
      end_date: { type: DataTypes.DATE, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      is_delete: { type: DataTypes.BOOLEAN, defaultValue: false },
      facade_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      tableName: "featur_facade",
      modelName: "FeaturFacade",
      underscored: true,
    }
  );
  return FeaturFacade;
};
