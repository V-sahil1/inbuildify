import { DataTypes } from "sequelize";

export default (sequelize) => {
  const DriveActivityLog = sequelize.define(
    "DriveActivityLog",
    {
      log_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entity_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      entity_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      details: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "drive_activity_logs",
      modelName: "DriveActivityLog",
      underscored: true,
      timestamps: true,
    }
  );

  return DriveActivityLog;
};
