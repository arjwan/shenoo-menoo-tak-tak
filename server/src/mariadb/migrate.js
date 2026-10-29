'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const database = require('./database');

async function migrate() {
  const pool = await database.connect();
  const connection = await pool.getConnection();
  let lock;
  try {
    const [[{ name }]] = await connection.query('SELECT DATABASE() AS name');
    lock = 'native_migrations_' + crypto.createHash('sha256').update(name).digest('hex').slice(0, 40);
    const [[{ acquired }]] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lock]);
    if (Number(acquired) !== 1) throw new Error('Another MariaDB migration is running');
    const [tables] = await connection.query('SHOW TABLES');
    if (tables.length && !tables.some(row => Object.values(row).includes('native_migrations'))) {
      throw new Error('Destination is not empty and has no native migration journal. No existing tables were changed.');
    }
    await connection.query(`CREATE TABLE IF NOT EXISTS native_migrations (
      name VARCHAR(120) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
      steps INT UNSIGNED NOT NULL DEFAULT 0, complete BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB`);
    const directory = path.join(__dirname, 'migrations');
    const result = [];
    for (const name of fs.readdirSync(directory).filter(x => /^\d+_.+\.sql$/.test(x)).sort()) {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8').replace(/\r\n/g, '\n');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const [rows] = await connection.execute('SELECT * FROM native_migrations WHERE name = ?', [name]);
      if (rows[0] && rows[0].checksum !== checksum) throw new Error('Applied migration checksum differs: ' + name);
      if (rows[0]?.complete) { result.push({ name, applied: 0 }); continue; }
      if (!rows.length) await connection.execute('INSERT INTO native_migrations (name, checksum) VALUES (?, ?)', [name, checksum]);
      const statements = sql.replace(/^--.*$/gm, '').split(/;\s*(?:\r?\n|$)/).map(x => x.trim()).filter(Boolean);
      const start = Number(rows[0]?.steps || 0);
      for (let step = start; step < statements.length; step++) {
        // MariaDB DDL commits independently. Record progress, never drop/recreate.
        // A crash between DDL and this update fails closed for manual inspection.
        await connection.query(statements[step]);
        await connection.execute('UPDATE native_migrations SET steps = ? WHERE name = ?', [step + 1, name]);
      }
      await connection.execute('UPDATE native_migrations SET complete = TRUE WHERE name = ?', [name]);
      result.push({ name, applied: statements.length - start });
    }
    return result;
  } finally {
    if (lock) await connection.execute('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    connection.release();
  }
}
if (require.main === module) {
  require('dotenv').config({ quiet: true });
  migrate().then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error('MariaDB migration failed. Inspect the migration journal and database permissions; no tables were dropped.'); process.exitCode = 1; })
    .finally(() => database.close());
}
module.exports = { migrate };
