const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'build', '.gradle', '.idea', 'dist', 'coverage']);
const ignoredFiles = new Set([path.resolve(__filename)]);
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.xml', '.yml', '.yaml', '.md', '.txt', '.properties', '.gradle', '.kts', '.kt', '.java', '.sh', '.env']);
const rules = [
  ['private-key', new RegExp('-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')],
  ['github-token', new RegExp('gh' + '[pousr]_[A-Za-z0-9]{30,}')],
  ['openai-key', new RegExp('sk' + '-[A-Za-z0-9_-]{30,}')],
  ['aws-access-key', new RegExp('AK' + 'IA[0-9A-Z]{16}')],
  ['credentialed-mongodb-uri', new RegExp('mongodb(?:\\+srv)?:\\/\\/[^\\s:/]+:[^\\s@/]+@', 'i')],
  ['jwt-bearer-token', new RegExp('eyJ' + '[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}')]
];

function filesIn(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) output.push(...filesIn(path.join(directory, entry.name)));
      continue;
    }
    const file = path.join(directory, entry.name);
    if (ignoredFiles.has(file)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (textExtensions.has(extension) || entry.name === '.env' || entry.name === '.gitignore') output.push(file);
  }
  return output;
}

const findings = [];
for (const file of filesIn(root)) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const [name, pattern] of rules) {
    if (pattern.test(content)) findings.push({ file: path.relative(root, file), rule: name });
  }
}

if (process.argv.includes('--history')) {
  try {
    const history = execFileSync('git', ['log', '--all', '-p', '--no-ext-diff', '--format=commit:%H'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    for (const [name, pattern] of rules) {
      if (pattern.test(history)) findings.push({ file: 'git-history', rule: name });
    }
  } catch (error) {
    console.error('Secret history scan could not inspect the complete Git history.');
    process.exit(2);
  }
}

if (findings.length) {
  console.error('Secret scan failed. Potential credentials were found (values are intentionally hidden):');
  for (const finding of findings) console.error('- ' + finding.file + ' [' + finding.rule + ']');
  process.exit(1);
}
console.log('Secret scan passed: no known credential patterns found' + (process.argv.includes('--history') ? ' in files or Git history.' : '.'));
