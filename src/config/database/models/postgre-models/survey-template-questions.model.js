import { Model, DataTypes } from "sequelize";

export class SurveyTemplateQuestions extends Model {
  static associate(models) {
    SurveyTemplateQuestions.belongsTo(models.SurveyTemplate, { foreignKey: "survey_template_id", as: "surveyTemplate" });
    SurveyTemplateQuestions.belongsTo(models.Users, { foreignKey: "created_by", as: "createdByUser" });
    SurveyTemplateQuestions.belongsTo(models.Users, { foreignKey: "updated_by", as: "updatedByUser" });
  }
}

export default (sequelize) => {
  SurveyTemplateQuestions.init(
    {
      survey_question_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      survey_template_id: { type: DataTypes.UUID, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      option_type: {
        type: DataTypes.ENUM("text", "radio", "star_1_to_5", "star_1_to_10"),
        allowNull: false,
      },
      options: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
      created_by: { type: DataTypes.UUID, allowNull: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, tableName: "survey_template_questions", modelName: "SurveyTemplateQuestions", underscored: true }
  );
  return SurveyTemplateQuestions;
};