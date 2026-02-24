const pg = require('pg');
const LeadsService = require('./src/services/leads.service.js');
const LeadsRepository = require('./src/repositories/leads.repository.js');
const getPool = require('./src/config/database.js');

async function run() {
  const pool = getPool();
  try {
    // We will test the repository's getAllLeads method directly
    const res = await LeadsRepository.getAllLeads('some-builder-id', { name: 'Test Lead', limit: 1 });
    console.log("getAllLeads name filter test:", res);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
