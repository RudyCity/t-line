const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean and copy
try {
  console.log('Copying backend assets for Tauri...');
  const lockfile = path.join(__dirname, 'backend', 'bun.lock');
  if (!fs.existsSync(lockfile)) {
    throw new Error('Desktop backend Bun lockfile must be committed for reproducible packaging');
  }
  const lockedDependencies = fs.readFileSync(lockfile);
  if (fs.existsSync(path.join(__dirname, 'backend'))) {
    fs.rmSync(path.join(__dirname, 'backend'), { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(__dirname, 'backend'), { recursive: true });
  fs.writeFileSync(lockfile, lockedDependencies);
  copyDirSync(path.join(__dirname, '..', 'backend', 'dist'), path.join(__dirname, 'backend', 'dist'));
  fs.copyFileSync(path.join(__dirname, '..', 'backend', 'package.json'), path.join(__dirname, 'backend', 'package.json'));

  // Both dependency installation and runtime execution must use Bun. The
  // dedicated lockfile makes the staged package independent of the monorepo
  // root workspace lock and blocks unreviewed production version drift.
  const { resolveBuildBun } = require('./prepare-bun-runtime.js');
  const bunExecutable = resolveBuildBun();
  console.log('Installing pinned backend production dependencies with Bun...');
  execFileSync(bunExecutable, ['install', '--frozen-lockfile', '--production'], {
    cwd: path.join(__dirname, 'backend'), stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  });

  // Bundle the pinned-license Bun runtime for clean Windows installs.
  // The launcher uses this verified Bun binary without relying on a host installation.
  require('./prepare-bun-runtime.js').prepareBunRuntime(__dirname);

  // Remove .bin folder to completely avoid symlinks
  const binPath = path.join(__dirname, 'backend', 'node_modules', '.bin');
  if (fs.existsSync(binPath)) {
    fs.rmSync(binPath, { recursive: true, force: true });
  }

  console.log('Copying frontend assets for Tauri...');
  if (fs.existsSync(path.join(__dirname, 'frontend'))) {
    fs.rmSync(path.join(__dirname, 'frontend'), { recursive: true, force: true });
  }
  copyDirSync(path.join(__dirname, '..', 'frontend', 'dist'), path.join(__dirname, 'frontend', 'dist'));
  
  console.log('Tauri assets copied successfully!');
} catch (err) {
  console.error('Error copying Tauri assets:', err);
  process.exit(1);
}
