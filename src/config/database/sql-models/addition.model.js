import { Model, DataTypes } from "sequelize";

export class Addition extends Model {
  static associate(models) {
    // No foreign key relationships
  }
}

export default (sequelize) => {
  Addition.init(
    {
      addition_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      num1: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      num2: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      result: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      tableName: "addition",
      modelName: "Addition",
      underscored: true,
    }
  );

  return Addition;
};