import { Model, DataTypes } from "sequelize";

export class ComplianceType extends Model {
  static associate(models) {}
}
export default (sequelize) => {
  ComplianceType.init({
    compliance_type_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    createdAt: { type: DataTypes.DATE },
  }, { sequelize, tableName: "compliance_type", modelName: "ComplianceType", underscored: true, updatedAt: false });
  return ComplianceType;
};