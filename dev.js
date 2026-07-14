const { spawn } = require('child_process');
const net = require('net');

const isBun = process.versions.bun !== undefined;
const runner = isBun ? 'bun' : 'npm';

const target = process.argv[2]; // 'backend', 'frontend', 'tauri', or undefined (both)

console.log(`[t-line] Starting dev servers using ${runner}...`);

function checkPort(port) {
  return new Promise((resolve) => {
    const client = net.connect({ port, host: '127.0.0.1' }, () => {
      client.end();
      resolve(true);
    });
    client.on('error', () => {
      const client6 = net.connect({ port, host: '::1' }, () => {
        client6.end();
        resolve(true);
      });
      client6.on('error', () => {
        resolve(false);
      });
    });
  });
}

async function main() {
  const runBackend = !target || target === 'backend' || target === 'tauri';
  const runFrontend = !target || target === 'frontend' || target === 'tauri';
  const runTauri = target === 'tauri';

  const processes = [];

  // Clean up previous processes on ports 5773, 5779 and any running desktop instances
  console.log('[t-line] Cleaning up previous processes...');
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      if (runBackend) {
        execSync('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5779 -State Listen -ErrorAction SilentlyContinue | Foreach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"');
      }
      if (runFrontend) {
        execSync('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5773 -State Listen -ErrorAction SilentlyContinue | Foreach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"');
      }
      // Kill any running t-line desktop app instances
      execSync('powershell -NoProfile -Command "Get-Process -Name \'t-line*\' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"');
    } else {
      if (runBackend) execSync('lsof -t -i:5779 | xargs kill -9 2>/dev/null || true');
      if (runFrontend) execSync('lsof -t -i:5773 | xargs kill -9 2>/dev/null || true');
      // Kill any running t-line desktop app instances
      execSync('pkill -9 t-line 2>/dev/null || true');
    }
    // Brief pause to allow OS to free ports
    await new Promise(resolve => setTimeout(resolve, 800));
  } catch (e) {
    // Ignore errors
  }

  if (runBackend) {
    const active = await checkPort(5779);
    if (active) {
      console.log('[t-line] Backend dev server is already running on port 5779.');
    } else {
      console.log('[t-line] Starting backend dev server...');
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
  }

  if (runFrontend) {
    const active = await checkPort(5773);
    if (active) {
      console.log('[t-line] Frontend dev server is already running on port 5773.');
    } else {
      console.log('[t-line] Starting frontend dev server...');
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
  }

  if (runTauri) {
    console.log('[t-line] Starting Tauri dev...');
    const tauriArgs = isBun
      ? ['run', '--cwd', 'desktop-tauri', 'tauri', 'dev']
      : ['run', 'tauri', 'dev', '--workspace=desktop-tauri'];
    const tauri = spawn(runner, tauriArgs, { stdio: 'inherit', shell: true });
    processes.push(tauri);
    tauri.on('exit', (code) => {
      console.log(`[t-line] Tauri process exited with code ${code}`);
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
}

main().catch(err => {
  console.error('[t-line] Error starting servers:', err);
  process.exit(1);
});
