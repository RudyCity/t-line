const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  if (fs.existsSync(path.join(__dirname, 'backend'))) {
    fs.rmSync(path.join(__dirname, 'backend'), { recursive: true, force: true });
  }
  copyDirSync(path.join(__dirname, '..', 'backend', 'dist'), path.join(__dirname, 'backend', 'dist'));
  fs.copyFileSync(path.join(__dirname, '..', 'backend', 'package.json'), path.join(__dirname, 'backend', 'package.json'));

  console.log('Installing production dependencies for backend...');
  execSync('npm install --omit=dev', {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit'
  });

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
