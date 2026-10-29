'use strict';
require('dotenv').config({ quiet: true });
const database = require('../mariadb/database');
const accounts = require('../mariadb/developer-accounts');
async function main() {
  const result = await accounts.provision(process.env, true);
  console.log('Developer password recovered; existing sessions revoked. MFA records were preserved. Account ID: ' + result.id);
}
if (require.main === module) main().catch(() => {
  console.error('Developer recovery refused. Check the exact active developer ID and setup configuration; ordinary accounts cannot be promoted.');
  process.exitCode = 1;
}).finally(() => database.close());
module.exports = { main };
