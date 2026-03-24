import { Model, DataTypes } from "sequelize";

export class JobVariationApproval extends Model {
  static associate(models) {
    JobVariationApproval.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    JobVariationApproval.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    JobVariationApproval.belongsTo(models.Role, { foreignKey: "role_id", as: "role" });
    JobVariationApproval.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    JobVariationApproval.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  JobVariationApproval.init(
    {
      job_variation_approval_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      company_id: { type: DataTypes.UUID, allowNull: true },
      builder_id: { type: DataTypes.UUID, allowNull: true },
      role_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_variation_approval", modelName: "JobVariationApproval", underscored: true }
  );
  return JobVariationApproval;
};