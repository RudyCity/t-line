const fs = require('fs');
const path = require('path');

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
  console.log('Copying backend assets...');
  if (fs.existsSync(path.join(__dirname, 'backend'))) {
    fs.rmSync(path.join(__dirname, 'backend'), { recursive: true, force: true });
  }
  copyDirSync(path.join(__dirname, '..', 'backend', 'dist'), path.join(__dirname, 'backend', 'dist'));
  fs.copyFileSync(path.join(__dirname, '..', 'backend', 'package.json'), path.join(__dirname, 'backend', 'package.json'));

  console.log('Copying frontend assets...');
  if (fs.existsSync(path.join(__dirname, 'frontend'))) {
    fs.rmSync(path.join(__dirname, 'frontend'), { recursive: true, force: true });
  }
  copyDirSync(path.join(__dirname, '..', 'frontend', 'dist'), path.join(__dirname, 'frontend', 'dist'));
  
  console.log('Assets copied successfully!');
} catch (err) {
  console.error('Error copying assets:', err);
  process.exit(1);
}
