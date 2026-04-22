import db from "../config/database/models/postgre-models/index.js";

/**
 * Checks if a lead is locked.
 * A lead is considered locked if any associated opportunity has an out_come of 'won' or 'lost'.
 * Throws an error if the lead is locked.
 * 
 * @param {string} leadId - The UUID of the lead to check.
 */
export const checkLeadLockStatus = async (leadId) => {
  if (!leadId) return;

  const { Opportunity } = db;
  
  const opportunity = await Opportunity.findOne({
    where: {
      leads_id: leadId,
      out_come: {
        [db.Sequelize.Op.in]: ['lost', 'won']
      }
    },
    attributes: ['out_come'],
    raw: true
  });

  if (opportunity) {
    const outCome = opportunity.out_come;
    const error = new Error(`This action cannot be performed because an associated opportunity has been marked as ${outCome}.`);
    error.status = 400;
    throw error;
  }
};
