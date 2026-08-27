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

// Whitelist of Monaco language files to copy. The full monaco-editor package
// ships 50+ language bundles (abap, apex, azcli, bat, bicep, cameligo, clojure,
// ...) that t-line never displays. Restricting to the languages we actually
// use cuts the bundled `vs/` directory from ~16 MB to ~3 MB and saves 10-30 MB
// of WebView memory per app instance. Add a language to this set if the file
// viewer needs to syntax-highlight it.
const ALLOWED_LANGUAGE_PREFIXES = new Set([
  'typescript', 'javascript', 'javascript_.', // typescript, javascript, typescript.js
  'json', 'jsonc', 'json-mode',
  'markdown', 'css', 'html',
  'typescript-mode', 'javascript-mode', 'css-mode', 'html-mode',
  'tsx', 'jsx',
]);
// Always copy: editor core, base utilities, language contribution registry
const ALWAYS_COPY = new Set([
  'editor', 'base', 'basic-languages', 'language',
  '_commonjsHelpers', 'monaco.contribution',
  'assets',
  'loader', 'nls', 'standalone',
]);

function shouldCopyFile(filename) {
  if (ALWAYS_COPY.has(filename)) return true;
  const base = filename.split('-')[0].split('.')[0]; // e.g. "typescript" from "typescript-XYZ.js"
  if (ALLOWED_LANGUAGE_PREFIXES.has(base)) return true;
  if (ALLOWED_LANGUAGE_PREFIXES.has(filename.replace(/\.js$/, ''))) return true;
  return false;
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    if (entry.isDirectory() && !ALWAYS_COPY.has(entry.name)) {
      // Only recurse into directories that are in ALWAYS_COPY (e.g. editor/)
      continue;
    }
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      if (shouldCopyFile(entry.name)) {
        fs.copyFileSync(srcPath, destPath);
      }
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
