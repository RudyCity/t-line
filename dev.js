const { spawn } = require('child_process');

const isBun = process.versions.bun !== undefined;
const runner = isBun ? 'bun' : 'npm';

const target = process.argv[2]; // 'backend', 'frontend', or undefined (both)

console.log(`[t-line] Starting dev servers using ${runner}...`);

const runBackend = !target || target === 'backend';
const runFrontend = !target || target === 'frontend';

const processes = [];

if (runBackend) {
  const backendArgs = isBun 
    ? ['run', '--cwd', 'backend', 'dev'] 
    : ['run', 'dev', '--workspace=backend'];
  const backend = spawn(runner, backendArgs, { stdio: 'inherit', shell: true });
  processes.push(backend);
  backend.on('exit', (code) => {
    console.log(`[t-line] Backend process exited with code ${code}`);
    handleExit(code);
  });
}

if (runFrontend) {
  const frontendArgs = isBun 
    ? ['run', '--cwd', 'frontend', 'dev'] 
    : ['run', 'dev', '--workspace=frontend'];
  const frontend = spawn(runner, frontendArgs, { stdio: 'inherit', shell: true });
  processes.push(frontend);
  frontend.on('exit', (code) => {
    console.log(`[t-line] Frontend process exited with code ${code}`);
    handleExit(code);
  });
}

let exiting = false;
function handleExit(code) {
  if (exiting) return;
  exiting = true;
  for (const proc of processes) {
    try {
      proc.kill();
    } catch (e) {}
  }
  process.exit(code || 0);
}

process.on('SIGINT', () => handleExit(0));
process.on('SIGTERM', () => handleExit(0));
