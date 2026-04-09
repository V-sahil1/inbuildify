"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("structure_engineer", "price", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 0, // required for existing rows
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("structure_engineer", "price");
  },
};