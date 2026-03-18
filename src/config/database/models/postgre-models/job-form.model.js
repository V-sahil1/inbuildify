import { Model, DataTypes } from "sequelize";

export class JobForm extends Model {
  static associate(models) {
    JobForm.belongsTo(models.Leads, { foreignKey: "leads_id", as: "lead" });
  }
}

export default (sequelize) => {
  JobForm.init(
    {
      job_form_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      leads_id: { type: DataTypes.UUID, allowNull: true },
      street_name: { type: DataTypes.STRING(255), allowNull: false },
      land_developer: { type: DataTypes.STRING(255), allowNull: true },
      council: { type: DataTypes.STRING(255), allowNull: true },
      title_volume: { type: DataTypes.STRING(255), allowNull: true },
      folio: { type: DataTypes.STRING(255), allowNull: true },
      plan_subdivision: { type: DataTypes.STRING(255), allowNull: true },
      site_fall: { type: DataTypes.STRING(255), allowNull: true },
      existing_tree: { type: DataTypes.BOOLEAN, allowNull: true },
      driveaway_location: { type: DataTypes.STRING(255), allowNull: true },
      any_sewer_tie: { type: DataTypes.BOOLEAN, allowNull: true },
      easements: { type: DataTypes.BOOLEAN, allowNull: true },
      buildup_area_easements: { type: DataTypes.BOOLEAN, allowNull: true },
      build_zone: { type: DataTypes.STRING(255), allowNull: true },
      story_id: { type: DataTypes.UUID, allowNull: true },
      finished_surface_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      existing_surface_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      filled_area_fill_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      max_fill_location: { type: DataTypes.STRING(255), allowNull: true },
      max_finished_surface_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      min_finished_surface_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      engineering_fall_m: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      fall_type: { type: DataTypes.STRING(255), allowNull: true },
      ceiling_height: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      eaves_location: { type: DataTypes.STRING(255), allowNull: true },
      lot_type: { type: DataTypes.STRING(255), allowNull: true },
      site_coverage_allowed: { type: DataTypes.STRING(255), allowNull: true },
      eaves_size: { type: DataTypes.STRING(255), allowNull: true },
      eaves_return: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
      roof_covering: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
      roof_pitch: { type: DataTypes.STRING(255), allowNull: true },
      flat_roof_pitch: { type: DataTypes.STRING(255), allowNull: true },
      parapet_wall: { type: DataTypes.STRING(255), allowNull: true },
      facade_material_requirement: { type: DataTypes.JSONB, defaultValue: {} },
      special_job_notes: { type: DataTypes.STRING(500), allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "job_form", modelName: "JobForm", underscored: true }
  );
  return JobForm;
};