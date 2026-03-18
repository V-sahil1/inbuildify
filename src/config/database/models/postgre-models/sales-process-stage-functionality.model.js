import { Model, DataTypes } from "sequelize";

export class SalesProcessStageFunctionality extends Model {
  static associate(models) {
    // No FK relationships
  }
}

export default (sequelize) => {
  SalesProcessStageFunctionality.init(
    {
      functionality_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "sales_process_stage_functionality", modelName: "SalesProcessStageFunctionality", underscored: true }
  );
  return SalesProcessStageFunctionality;
};