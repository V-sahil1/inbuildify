import { Model, DataTypes } from "sequelize";

export class LeadsContactMap extends Model {
  static associate(models) {
    LeadsContactMap.belongsTo(models.Leads, { foreignKey: "leads_id", as: "lead", onDelete: "CASCADE" });
  }
}

export default (sequelize) => {
  LeadsContactMap.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      leads_id: { type: DataTypes.UUID, allowNull: true },
      contact_id: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "leads_contact_map", modelName: "LeadsContactMap", underscored: true }
  );
  return LeadsContactMap;
};
