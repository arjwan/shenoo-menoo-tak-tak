'use strict';
require('dotenv').config({ quiet: true });
const database = require('../mariadb/database');
const accounts = require('../mariadb/developer-accounts');
async function main() {
  const result = await accounts.provision(process.env);
  console.log('Developer bootstrap: ' + result.action + '. Account ID: ' + result.id);
}
if (require.main === module) main().catch(() => {
  console.error('Developer bootstrap refused. Check explicit authorization and identity configuration; ordinary accounts cannot be promoted.');
  process.exitCode = 1;
}).finally(() => database.close());
module.exports = { main };
