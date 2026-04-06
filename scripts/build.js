import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const pluginsDir = new URL('../plugins', import.meta.url).pathname;
const filterArg = process.argv.indexOf('--filter');
const filters =
  filterArg !== -1 && process.argv[filterArg + 1]
    ? process.argv[filterArg + 1].split(',')
    : null;

const plugins = readdirSync(pluginsDir).filter(name => {
  if (!existsSync(join(pluginsDir, name, 'package.json'))) return false;
  return filters ? filters.includes(name) : true;
});

if (plugins.length === 0) {
  console.log('No plugins matched.');
  process.exit(0);
}

let failed = false;
for (const name of plugins) {
  const dir = join(pluginsDir, name);
  console.log(`\n=== Building ${name} ===\n`);
  try {
    execSync('npm install && npm run build', { cwd: dir, stdio: 'inherit' });
  } catch {
    console.error(`\n!!! ${name} build failed !!!\n`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
