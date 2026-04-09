"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("quotation_version", "structure_engineer_id", {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await queryInterface.addColumn("quotation_version", "structure_engineer_price", {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,

    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("quotation_version", "structure_engineer_id");
    await queryInterface.removeColumn("quotation_version", "structure_engineer_id");
  },
};