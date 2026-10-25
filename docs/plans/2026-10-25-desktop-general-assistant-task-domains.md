# Desktop general assistant task domains — 2026-10-25

The **Assistant tasks** panel is now domain-agnostic. The user can select **General Assistant, Research, Analysis, Planning, Files & Documents, or Coding** and submit a natural-language goal as a persistent draft. The domain is forwarded through the existing authenticated, fixed-action desktop proxy and is saved by the same Core task coordinator used for all detached work.

New interface behavior:
- Domain selector is populated from the **Core-advertised capabilities**. If connected to an older Core lacking the manifest, only its legacy read-only analysis mode is shown.
- The selected domain and title are sent together on draft creation. Task rows display the persisted domain; Run remains explicit, non-mutating and independent of the main chat.
- Only a **Coding** task may show the isolated **Patch** control; no other domain acquires editing or shell rights.
- Existing Cancel, Reconcile, Result and Review patch actions remain scope/revision guarded.
- The everyday T-Line chat remains unrestricted as a conversational UX; task domains constrain only the *detached worker's* tool profile.

Not yet provided by detached workers: active browser/desktop control, document creation, app automation, scheduled tasks, surviving Core restarts. These need separate capability ownership, permissions and E2E validation. Do not market them as already supported in background mode.

Documentation files and tests target only the T-Line/Core path, leaving Muse, Studio and managed-browser development unchanged.
