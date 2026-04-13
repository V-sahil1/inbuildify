"use strict";

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn("job", "status", {
    type: Sequelize.STRING(50),
    allowNull: false,
    defaultValue: "In Progress",
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn("job", "status");
}
