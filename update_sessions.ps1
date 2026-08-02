param([string]$filePath)

$c = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# 1) After getNormalizedWsKey: add MAX_CACHED_MSGS + safeSetItem
$re = [regex]'(?s)(export function getNormalizedWsKey\(.*?return normalized\.replace\(/\\\\/g, ''/''\)\.toLowerCase\(\);\n\})'
$replace = @'
$1

const MAX_CACHED_MSGS = 300;

/** Safe localStorage.setItem with quota-exceeded auto-prune of oldest caches */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[localStorage] Quota exceeded, pruning oldest session caches');
      const prefix = 'superagent_messages_';
      const keys: { key: string; time: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const sessMatch = k.match(/_(sess_(\d+)_[^_]+)$/);
          const time = sessMatch ? parseInt(sessMatch[2]) : 0;
          keys.push({ key: k, time });
        }
      }
      keys.sort((a, b) => a.time - b.time);
      const toRemove = keys.slice(0, Math.max(0, keys.length - 5));
      toRemove.forEach(k => { try { localStorage.removeItem(k.key); } catch {} });
      try {
        localStorage.setItem(key, value);
      } catch (e2) {
        console.error('[localStorage] Still quota exceeded after prune:', e2);
      }
    } else {
      console.warn('[localStorage] setItem failed:', e);
    }
  }
}
'@
$c = $re.Replace($c, $replace)

# 2) Replace all try { localStorage.setItem(...) } catch (e) {} with safeSetItem
$re2 = [regex]'try \{\s*localStorage\.setItem\(([^)]+)\);\s*\} catch \(e\) \{\}'
$c = $re2.Replace($c, 'safeSetItem($1);')

# Also handle the one without outer try-catch (line 115 area)
$re2b = [regex]'(?<!\btry \{)\s*localStorage\.setItem\(([^)]+)\);\s*(?!\s*\} catch)'
$c = $re2b.Replace($c, 'safeSetItem($1);')

# 3) Replace messages.slice(-300) with messages.slice(-MAX_CACHED_MSGS)
$c = $c -replace 'messages\.slice\(-300\)', 'messages.slice(-MAX_CACHED_MSGS)'

# 4) In pruneOldSessionCaches: add cleanupOrphanedPinned function after it
$re4 = [regex]'(?s)(function pruneOldSessionCaches\(wsKey: string, activeSessionIds: string\[\], maxKeep = 25\) \{[\s\S]*?keysToRemove\.forEach\(k => localStorage\.removeItem\(k\)\);[\s\S]*?\})'
$replace4 = @'
$1

/** Cleanup orphaned pinned session IDs that no longer exist in sessions list */
function cleanupOrphanedPinned(wsKey: string, validSessionIds: Set<string>): void {
  try {
    const pinnedKey = 'superagent_pinned_sessions_' + wsKey;
    const saved = localStorage.getItem(pinnedKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((id: string) => validSessionIds.has(id));
        if (filtered.length !== parsed.length) {
          safeSetItem(pinnedKey, JSON.stringify(filtered));
        }
      }
    }
  } catch (e) {}
}
'@
$c = $re4.Replace($c, $replace4)

# 5) Add cross-tab storage event listener after workspace sync effect
$re5 = [regex]'(?s)(// Sync on workspace changes\n  useEffect\(\(\) => \{[\s\S]*?syncSessions\(workspace\);[\s\S]*?prevWorkspaceRef\.current = workspace;[\s\S]*?\}, \[workspace, syncSessions\]\);)'
$replace5 = @'
$1

  // Cross-tab sync: listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key && e.key.includes(getNormalizedWsKey(workspace))) {
        syncSessions(workspace, activeSessionIdRef.current);
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [workspace, syncSessions]);
'@
$c = $re5.Replace($c, $replace5)

# 6) In handleDeleteSession: call cleanupOrphanedPinned after deletion
$re6 = [regex]'(?s)(let remainingSessions: ChatSession\[\] = \[\];\s*setSessions\(prev => \{[\s\S]*?return remainingSessions;\s*\}\);)([\s\S]*?window\.dispatchEvent)'
$replace6 = @'
$1
    cleanupOrphanedPinned(wsKey, new Set(remainingSessions.map(s => s.id)));
$2
'@
$c = $re6.Replace($c, $replace6)

[System.IO.File]::WriteAllText($filePath, $c, [System.Text.Encoding]::UTF8)
Write-Host "Done"