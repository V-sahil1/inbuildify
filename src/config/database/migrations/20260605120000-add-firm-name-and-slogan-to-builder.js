"use strict";

export async function up(queryInterface, Sequelize) {
  const tableInfo = await queryInterface.describeTable("builder");

  if (!tableInfo.firm_name) {
    await queryInterface.addColumn("builder", "firm_name", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  }

  if (!tableInfo.slogan) {
    await queryInterface.addColumn("builder", "slogan", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  }
}

export async function down(queryInterface) {
  const tableInfo = await queryInterface.describeTable("builder");

  if (tableInfo.firm_name) {
    await queryInterface.removeColumn("builder", "firm_name");
  }

  if (tableInfo.slogan) {
    await queryInterface.removeColumn("builder", "slogan");
  }
}
