import { Model, DataTypes } from "sequelize";

export class Notes extends Model {
  static associate(models) {
    Notes.belongsTo(models.Leads, { foreignKey: "leads_id", as: "lead" });
  }
}

export default (sequelize) => {
  Notes.init(
    {
      notes_id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      leads_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "leads",
          key: "leads_id",
        },
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      note_tag_id: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        defaultValue: [],
        field: "note_tag_id",
      },
      send_to_customer: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "send_to_customer",
      },
      create_follow_up_task: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "create_follow_up_task",
      },
      attach_file: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "attach_file",
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "notes",
      modelName: "Notes",
      underscored: true,
      timestamps: true,
    },
  );
  return Notes;
};
