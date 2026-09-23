'use strict';
// Surgically ensure school-classroom routes are mounted in server.js without
// touching cards/calls/messages mounts. Idempotent.
const fs = require('fs');
const path = require('path');
const serverPath = process.argv[2] || path.resolve('server/src/server.js');
let src = fs.readFileSync(serverPath, 'utf8');
const backup = serverPath + '.pre-school-mount';
if (!fs.existsSync(backup)) fs.copyFileSync(serverPath, backup);

const requireLine = "const schoolClassroomRoutes = require('./routes/school-classroom.routes');";
const useLine = "app.use('/api/school', schoolClassroomRoutes);";

if (!src.includes("school-classroom.routes")) {
  // Insert require near other school requires
  const markers = [
    /const schoolCanvaRoutes = require\('\.\/routes\/school-canva\.routes'\);/,
    /const schoolRoutes = require\('\.\/routes\/school\.routes'\);/,
    /const schoolSyncRoutes = require\('\.\/routes\/school[^']*'\);/,
  ];
  let placed = false;
  for (const re of markers) {
    if (re.test(src)) {
      src = src.replace(re, (m) => `${m}\n${requireLine}`);
      placed = true;
      break;
    }
  }
  if (!placed) {
    // after last require(
    const idx = src.lastIndexOf("require('./routes/");
    if (idx < 0) throw new Error('cannot find require block in server.js');
    const nl = src.indexOf('\n', idx);
    src = src.slice(0, nl + 1) + requireLine + '\n' + src.slice(nl + 1);
  }
}

if (!src.includes("schoolClassroomRoutes") || !/app\.use\(\s*['"]\/api\/school['"]\s*,\s*schoolClassroomRoutes\s*\)/.test(src)) {
  const useMarkers = [
    /app\.use\(\s*['"]\/api\/school['"]\s*,\s*schoolRoutes\s*\);/,
    /app\.use\(\s*['"]\/api\/school-canva['"]\s*,\s*schoolCanvaRoutes\s*\);/,
    /app\.use\(\s*['"]\/api\/school['"]\s*,\s*schoolCanvaRoutes\s*\);/,
    /app\.use\(\s*['"]\/api\/school['"]\s*,\s*schoolSyncRoutes\s*\);/,
  ];
  let placed = false;
  for (const re of useMarkers) {
    if (re.test(src)) {
      src = src.replace(re, (m) => `${m}\n${useLine}`);
      placed = true;
      break;
    }
  }
  if (!placed) {
    // before /uploads static
    if (src.includes("app.use('/uploads'")) {
      src = src.replace(/app\.use\(\s*['"]\/uploads['"]/, `${useLine}\napp.use('/uploads'`);
    } else {
      throw new Error('cannot find place to mount schoolClassroomRoutes');
    }
  }
}

// Refuse to drop cards mount if it was present in backup
const hadCards = fs.readFileSync(backup, 'utf8').includes('cards-canva');
if (hadCards && !src.includes('cards-canva')) {
  throw new Error('Refusing to write server.js: cards-canva mount would be lost');
}

fs.writeFileSync(serverPath, src);
console.log('school-classroom mount ensured in', serverPath);
if (hadCards) console.log('cards-canva mount preserved');
