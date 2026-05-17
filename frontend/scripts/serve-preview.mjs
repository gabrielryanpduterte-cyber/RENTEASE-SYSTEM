import { spawn } from 'node:child_process';

const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? String(parsedPort) : '4173';

const child = spawn(
  'npx',
  ['vite', 'preview', '--host', '0.0.0.0', '--port', port],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
