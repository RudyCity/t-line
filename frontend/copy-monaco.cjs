const fs = require('fs');
const path = require('path');

// Resolve monaco-editor source path, checking local node_modules, parent node_modules (hoisted), and via require.resolve
const localSrcDir = path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs');
const parentSrcDir = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const destDir = path.join(__dirname, 'public', 'vs');

let srcDir = '';
if (fs.existsSync(localSrcDir)) {
  srcDir = localSrcDir;
} else if (fs.existsSync(parentSrcDir)) {
  srcDir = parentSrcDir;
} else {
  try {
    const pkgPath = require.resolve('monaco-editor/package.json');
    const resolvedPath = path.join(path.dirname(pkgPath), 'min', 'vs');
    if (fs.existsSync(resolvedPath)) {
      srcDir = resolvedPath;
    }
  } catch (err) {
    // Fallback if require.resolve fails
  }
}

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

try {
  if (!srcDir || !fs.existsSync(srcDir)) {
    console.warn(`[Monaco Sync] Source directory not found. Checked:`);
    console.warn(`  - ${localSrcDir}`);
    console.warn(`  - ${parentSrcDir}`);
    console.warn(`Make sure 'monaco-editor' is installed in the workspace.`);
    process.exit(0);
  }

  console.log(`[Monaco Sync] Copying Monaco Editor assets from: ${srcDir}`);
  console.log(`[Monaco Sync] Target local public directory: ${destDir}`);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  copyDirSync(srcDir, destDir);
  console.log(`[Monaco Sync] Copied Monaco Editor successfully!`);
} catch (err) {
  console.error('[Monaco Sync] Failed to copy Monaco Editor assets:', err);
  process.exit(1);
}
