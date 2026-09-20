'use strict';
// Helper: ensure the "latest" Canva export path exists. If only the update
// export is present, copy it. Never overwrites a newer distinct latest.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const latest = path.join(root, 'original-assets/school-canva/school-canva-latest-20260920.html');
const update = path.join(root, 'original-assets/school-canva/school-canva-update-20260920.html');
if (!fs.existsSync(latest)) {
  if (!fs.existsSync(update)) {
    console.error('No Canva school export found to import');
    process.exit(1);
  }
  fs.copyFileSync(update, latest);
  console.log('imported latest from update export');
} else {
  console.log('latest already present:', fs.statSync(latest).size, 'bytes');
}
