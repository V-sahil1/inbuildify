"use strict";

export default {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE leads
      SET created_at = CURRENT_TIMESTAMP
      WHERE created_at IS NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leads
      ALTER COLUMN created_at DROP DEFAULT;
    `);
  },
};
