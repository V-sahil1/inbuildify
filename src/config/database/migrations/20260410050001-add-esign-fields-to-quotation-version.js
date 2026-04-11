'use strict';

export default  {
  up: async (queryInterface, Sequelize) => {
    // Add e-signature fields to quotation_version table
    await queryInterface.addColumn('quotation_version', 'esign_status', {
      type: Sequelize.ENUM('pending', 'sent', 'signed', 'completed', 'declined'),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn('quotation_version', 'esign_envelope_id', {
      type: Sequelize.UUID,
      allowNull: true
    });

    await queryInterface.addColumn('quotation_version', 'signed_pdf_url', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Add indexes for the new fields
    await queryInterface.addIndex('quotation_version', ['esign_status']);
    await queryInterface.addIndex('quotation_version', ['esign_envelope_id']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('quotation_version', ['esign_status']);
    await queryInterface.removeIndex('quotation_version', ['esign_envelope_id']);

    // Remove columns
    await queryInterface.removeColumn('quotation_version', 'esign_status');
    await queryInterface.removeColumn('quotation_version', 'esign_envelope_id');
    await queryInterface.removeColumn('quotation_version', 'signed_pdf_url');
  }
};
