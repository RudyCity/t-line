#!/usr/bin/env node
/**
 * scripts/sync-version.cjs
 *
 * Single source of truth: desktop-tauri/package.json (Tauri is the shipped artifact).
 * Syncs the version field across all version-bearing manifests in the repo.
 *
 * Usage:
 *   node scripts/sync-version.cjs           # uses source version
 *   node scripts/sync-version.cjs 1.3.678   # override version explicitly
 *
 * Targets:
 *   - package.json                         (root)
 *   - backend/package.json
 *   - frontend/package.json
 *   - desktop-tauri/package.json           (source of truth when no arg given)
 *   - desktop-tauri/backend/package.json
 *   - desktop-tauri/src-tauri/Cargo.toml
 *   - desktop-tauri/src-tauri/tauri.conf.json
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Source manifest (shipped artifact: Tauri desktop app)
const SOURCE_MANIFEST = path.join(REPO_ROOT, 'desktop-tauri', 'package.json');

// All manifests that carry a version field
const JSON_TARGETS = [
  path.join(REPO_ROOT, 'package.json'),
  path.join(REPO_ROOT, 'backend', 'package.json'),
  path.join(REPO_ROOT, 'frontend', 'package.json'),
  path.join(REPO_ROOT, 'desktop-tauri', 'package.json'),
  path.join(REPO_ROOT, 'desktop-tauri', 'backend', 'package.json'),
];

const CARGO_TOML = path.join(REPO_ROOT, 'desktop-tauri', 'src-tauri', 'Cargo.toml');
const TAURI_CONF = path.join(REPO_ROOT, 'desktop-tauri', 'src-tauri', 'tauri.conf.json');

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readVersionFromSource() {
  if (!fs.existsSync(SOURCE_MANIFEST)) {
    throw new Error(`Source manifest not found: ${SOURCE_MANIFEST}`);
  }
  const raw = fs.readFileSync(SOURCE_MANIFEST, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed.version || typeof parsed.version !== 'string') {
    throw new Error(`No version field in ${SOURCE_MANIFEST}`);
  }
  if (!SEMVER_RE.test(parsed.version)) {
    throw new Error(`Source version "${parsed.version}" is not a valid semver string`);
  }
  return parsed.version;
}

function updateJsonVersion(file, version) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  const previous = parsed.version;
  parsed.version = version;
  const serialized = JSON.stringify(parsed, null, 2) + '\n';
  fs.writeFileSync(file, serialized, 'utf8');
  return { file, previous, current: version };
}

function updateCargoTomlVersion(file, version) {
  let raw = fs.readFileSync(file, 'utf8');
  const re = /^version\s*=\s*"[^"]*"/m;
  if (!re.test(raw)) {
    throw new Error(`No top-level version field found in ${file}`);
  }
  const previous = raw.match(re)[0];
  const updated = raw.replace(re, `version = "${version}"`);
  fs.writeFileSync(file, updated, 'utf8');
  return { file, previous, current: `version = "${version}"` };
}

function updateTauriConfVersion(file, version) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  const previous = parsed.version;
  parsed.version = version;
  const serialized = JSON.stringify(parsed, null, 2) + '\n';
  fs.writeFileSync(file, serialized, 'utf8');
  return { file, previous, current: version };
}

function main() {
  const argVersion = process.argv[2];
  const sourceVersion = readVersionFromSource();
  const targetVersion = argVersion || sourceVersion;

  if (argVersion && !SEMVER_RE.test(argVersion)) {
    throw new Error(`Provided version "${argVersion}" is not a valid semver string`);
  }

  console.log(`[sync-version] Source: ${SOURCE_MANIFEST}`);
  console.log(`[sync-version] Source version: ${sourceVersion}`);
  console.log(`[sync-version] Target version: ${targetVersion}`);

  const results = [];

  for (const file of JSON_TARGETS) {
    if (!fs.existsSync(file)) {
      console.warn(`[sync-version] SKIP (missing): ${path.relative(REPO_ROOT, file)}`);
      continue;
    }
    results.push(updateJsonVersion(file, targetVersion));
  }

  if (fs.existsSync(CARGO_TOML)) {
    results.push(updateCargoTomlVersion(CARGO_TOML, targetVersion));
  } else {
    console.warn(`[sync-version] SKIP (missing): ${path.relative(REPO_ROOT, CARGO_TOML)}`);
  }

  if (fs.existsSync(TAURI_CONF)) {
    results.push(updateTauriConfVersion(TAURI_CONF, targetVersion));
  } else {
    console.warn(`[sync-version] SKIP (missing): ${path.relative(REPO_ROOT, TAURI_CONF)}`);
  }

  // Skip the source itself in the "changed" report when no override was passed
  const sourceRel = path.relative(REPO_ROOT, SOURCE_MANIFEST);
  console.log('\n[sync-version] Results:');
  for (const r of results) {
    const rel = path.relative(REPO_ROOT, r.file);
    const changed = r.previous !== r.current;
    const marker = changed ? 'CHANGED' : 'unchanged';
    const isSource = rel === sourceRel && !argVersion;
    const tag = isSource ? ' (source, no override)' : '';
    console.log(`  [${marker}] ${rel}: ${JSON.stringify(r.previous)} -> ${JSON.stringify(r.current)}${tag}`);
  }

  if (argVersion && sourceVersion !== argVersion) {
    console.log(
      `\n[sync-version] NOTE: source manifest (${sourceRel}) was also updated to ${argVersion}.`
    );
  }

  console.log('\n[sync-version] Done.');
}

try {
  main();
} catch (err) {
  console.error(`[sync-version] FAILED: ${err.message}`);
  process.exit(1);
}
