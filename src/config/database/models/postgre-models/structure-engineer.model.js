import { Model, DataTypes } from "sequelize";

export class StructureEngineer extends Model {
  static associate(models) {
    StructureEngineer.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    StructureEngineer.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    StructureEngineer.belongsTo(models.Users, { foreignKey: "created_by", as: "createdBy" });
    StructureEngineer.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedBy" });
  }
}

export default (sequelize) => {
  StructureEngineer.init({
    structure_engineer_id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
    builder_id: { type: DataTypes.UUID, allowNull: true },
    company_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(255), allowNull: true },
    price: { type: DataTypes.INTEGER, allowNull: false },
    address: { type: DataTypes.STRING(500), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE },
    updated_at: { type: DataTypes.DATE },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    
  }, {
    sequelize,
    tableName: "structure_engineer",
    modelName: "StructureEngineer",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });
  return StructureEngineer;
};
