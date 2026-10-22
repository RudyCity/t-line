#!/usr/bin/env node
// T-Line release gate: generated Brain modules must match checked-in manifest.
// To detect newer upstream code, also run SuperAgent sync-brain-runtime.ts --check
// with both repositories available during integration/release.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const backend = path.resolve(__dirname, '../backend/src');
const manifestPath = path.join(backend, 'brain-runtime-manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error('Brain runtime manifest missing.');
const data = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if (data.schemaVersion !== 1 || !data.files || typeof data.files !== 'object') throw new Error('Invalid Brain source manifest.');
const expected = ['brainSessionLock.ts','brainStorageManager.ts','brainTransfers.ts','brainIndex.ts','brainObservability.ts','brainTasks.ts'];
for (const name of expected) {
  const file = path.join(backend, name);
  const reference = data.files[name];
  if (!/^[a-f0-9]{64}$/.test(reference || '')) throw new Error('Missing Brain source checksum: ' + name);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
  if (hash !== reference) throw new Error('T-Line Brain module drift: ' + name + '; regenerate from SuperAgent Core.');
}
console.log('T-Line Brain generated source matches the pinned canonical manifest.');
