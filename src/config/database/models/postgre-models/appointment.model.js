import { Model, DataTypes } from "sequelize";

export class Appointment extends Model {
  static associate(models) {
    Appointment.belongsTo(models.Company, { foreignKey: "company_id", as: "company" });
    Appointment.belongsTo(models.Builder, { foreignKey: "builder_id", as: "builder" });
    Appointment.belongsTo(models.Users, { foreignKey: "link_to", as: "linkedUser" });
    Appointment.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    Appointment.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  Appointment.init(
    {
      appointment_id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      builder_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      location_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      link_to: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      select_users: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        defaultValue: [],
      },
      notes: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      send_appointment_customer: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
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
      tableName: "appointment",
      modelName: "Appointment",
      underscored: true,
    }
  );

  return Appointment;
};
