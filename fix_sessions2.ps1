$f = "D:\backup from pc asus\Documents Development\t-line\frontend\src\components\useSuperAgentSessions.ts"
$c = [System.IO.File]::ReadAllText($f)

# Fix 1: Missing closing paren on safeSetItem calls
$c = $c -replace 'safeSetItem\(([^;]+);(\s*)$', 'safeSetItem($1);$2'

# Fix 2: Extra double-closing parens
$c = $c -replace 'safeSetItem\(([^)]+)\)\)\);', 'safeSetItem($1));'
$c = $c -replace 'safeSetItem\(([^)]+)\)\);', 'safeSetItem($1);'

# Fix 3: Remove orphaned catch blocks
$c = $c -replace "(?m)^\} catch \(e\) \{\}\n", ""
$c = $c -replace "(?m)^\} catch \(err\) \{\}\n", ""

# Fix 4: Remove orphaned try blocks
$c = $c -replace "(?m)^\s+try \{\s*$", ""

# Fix 5: Fix the orphaned catch in cleanupOrphanedPinned
$c = $c -replace 'cleanupOrphanedPinned\(wsKey: string, validSessionIds: Set<string>\).*?function', 'cleanupOrphanedPinned(wsKey: string, validSessionIds: Set<string>): void {
  try {
    const pinnedKey = '"'"'superagent_pinned_sessions_'"'"' + wsKey;
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

function'

[System.IO.File]::WriteAllText($f, $c)
Write-Host "Done"