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
const expected = ['brainSessionLock.ts','brainStorageManager.ts','brainTransfers.ts','brainIndex.ts','brainObservability.ts','brainTasks.ts','brainAgentCredentials.ts'];
for (const name of expected) {
  const file = path.join(backend, name);
  const reference = data.files[name];
  if (!/^[a-f0-9]{64}$/.test(reference || '')) throw new Error('Missing Brain source checksum: ' + name);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
  if (hash !== reference) throw new Error('T-Line Brain module drift: ' + name + '; regenerate from SuperAgent Core.');
}
const suggestionsPath = path.resolve(__dirname, '../frontend/src/generated/brainCommandSuggestions.json');
const suggestionsRaw = fs.readFileSync(suggestionsPath,'utf8').replace(/\r\n/g,'\n');
const suggestionsHash = crypto.createHash('sha256').update(suggestionsRaw).digest('hex');
if (!/^[a-f0-9]{64}$/.test(data.commandSuggestionsSha256 || '') ||
    suggestionsHash !== data.commandSuggestionsSha256) {
  throw new Error('T-Line Brain command suggestions drifted from the pinned SuperAgent catalog.');
}
const commandTree = JSON.parse(suggestionsRaw);
if (commandTree.schemaVersion !== 1 || !Array.isArray(commandTree.commands) ||
    commandTree.commands.length < 25 ||
    commandTree.commands.some(item =>
      typeof item.command !== 'string' || !item.command.startsWith('/brain ') ||
      typeof item.description !== 'string' || !item.description.trim()) ||
    new Set(commandTree.commands.map(item=>item.command)).size !== commandTree.commands.length) {
  throw new Error('Invalid generated Brain command suggestions.');
}
console.log('T-Line Brain generated source and subcommand suggestions match the pinned canonical manifest.');
