import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.HUSKY === '0') {
  console.warn('husky skipped (HUSKY=0)');
  process.exit(0);
}

const bin = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'husky.cmd' : 'husky',
);

if (!existsSync(bin)) {
  console.warn('husky skipped (dev dependencies not installed)');
  process.exit(0);
}

const isWindows = process.platform === 'win32';
const result = spawnSync(isWindows ? `"${bin}"` : bin, [], {
  stdio: 'inherit',
  shell: isWindows,
});

if (result.error) {
  console.warn('husky skipped (could not run)');
  process.exit(0);
}

process.exit(result.status ?? 0);
