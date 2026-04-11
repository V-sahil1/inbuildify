"use strict";

export default {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("structure_engineer");
    if (table.price) {
      return;
    }
    await queryInterface.addColumn("structure_engineer", "price", {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("structure_engineer");
    if (!table.price) {
      return;
    }
    await queryInterface.removeColumn("structure_engineer", "price");
  },
};