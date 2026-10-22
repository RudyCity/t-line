const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verifyTauriNsisExecutable } = require("../scripts/check-studio-installer-snapshot.cjs");

function example() {
  return Buffer.from("PE binary and encrypted resources ..." +
    " BUNDLE_TYPE_VAR_UNKbincsslesssasssty " +
    "StudioTab loaded from bundled resources", "ascii");
}
test("permits only the known three-byte Tauri NSIS bundle patch", () => {
  const raw = example();
  const compiled = Buffer.from(raw);
  const offset = raw.indexOf("BUNDLE_TYPE_VAR_") + "BUNDLE_TYPE_VAR_".length;
  compiled.write("NSS", offset, "ascii");
  assert.deepEqual(verifyTauriNsisExecutable(compiled, raw), {
    valid: true, mode: "verified-NSIS-marker-patch",
  });
  assert.deepEqual(verifyTauriNsisExecutable(raw, raw), {
    valid: true, mode: "byte-identical",
  });
});
test("fails closed on a changed backend resource, wrong marker or size", () => {
  const raw = example();
  const patched = Buffer.from(raw);
  patched.write("NSS", raw.indexOf("BUNDLE_TYPE_VAR_") + "BUNDLE_TYPE_VAR_".length, "ascii");
  patched[5] ^= 0xff;
  assert.equal(verifyTauriNsisExecutable(patched, raw).valid, false);
  const unexpected = Buffer.from(raw);
  unexpected.write("MSI", raw.indexOf("BUNDLE_TYPE_VAR_") + "BUNDLE_TYPE_VAR_".length, "ascii");
  assert.equal(verifyTauriNsisExecutable(unexpected, raw).valid, false);
  assert.equal(verifyTauriNsisExecutable(Buffer.concat([raw, Buffer.from("tamper")]), raw).valid, false);
});
