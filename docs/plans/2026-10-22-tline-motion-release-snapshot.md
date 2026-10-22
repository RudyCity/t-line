# T-Line Motion Studio — Real Release Build and Installer Identity Check

Date: 2026-10-22
Status: Windows NSIS/MSI release bundles built; byte-level Motion backend integrity checked; installed interactive GUI smoke still open.

## Build and packaging performed

- `bun run build:frontend` and `bun run build:backend` both passed.
- `bun --cwd desktop-tauri copy-assets` completed with Bun 1.4.2 and its bundled redistribution notices.
- `bun run build:tauri` rebuilt the native Rust release application, MSI and NSIS packages. The build output contains `t-line_1.3.699_x64-setup.exe` and `t-line_1.3.699_x64_en-US.msi`.
- `bun scripts/check-motion-release.cjs --json` reported that FFmpeg, production dependency audit, extracted NSIS Bun runtime/ConPTY, authenticated backend startup and NSIS resource integrity gates passed. Other production gates remain unverified by design.

## Independent native/installer snapshot verification

To inspect the current Windows installer:

```sh
bun scripts/check-motion-installer-snapshot.cjs
bun test tests/motionInstallerSnapshot.test.cjs
```

The independent checker:

1. Locates the Tauri NSIS installer using the actual `tauri.conf.json` version.
2. Requires exactly one current Motion Studio UI chunk and verifies it was built **before** the native release executable.
3. Compares the compiled backend Motion proxy and staged backend Motion proxy by complete SHA-256 hash.
4. Extracts `app.exe` and `backend/dist/motionProxy.js` directly from NSIS with 7-Zip.
5. Checks that the NSIS Motion proxy bytes match the currently compiled backend exactly.
6. Checks extracted `app.exe` against the built executable; accepts only the known Tauri-specific **three-byte** `BUNDLE_TYPE_VAR_UNK → BUNDLE_TYPE_VAR_NSS` marker patch, rejecting any other changed executable byte.
7. Fails closed if the installer predates the native executable, its compiled frontend Motion module, or required artifacts are missing.

This explicitly accounts for a byte-identical backend recompilation after installer creation: checksums are authoritative for the backend, not only timestamps.

Unit tests cover both the allowed known marker patch and rejection of altered code/resources or other bundle markers.

## Remaining production acceptance criteria

The snapshot gate does NOT prove that the currently built frontend JavaScript chunk can be extracted from inside Tauri's embedded executable, nor does it replace actually launching the installed application on Windows and exercising WebView2 login, local workspace permission, Motion Studio tab, video playback and download. These remain separate, honest acceptance steps. Vision model/Piper integration, long-duration render fault injection, signed Windows installer distribution and native font parity are also not certified by this snapshot checker.

The standalone real FFmpeg format smoke is in SuperAgent: `bun x vitest run tests/motionReleaseSmoke.test.ts --maxWorkers=1`.
