import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const nodeCmd = process.execPath;
const viteBin = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [
  spawn(nodeCmd, [resolve(root, 'server', 'index.mjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  }),
  spawn(nodeCmd, [viteBin, '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  }),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) shutdown(code ?? 1);
  });
}
