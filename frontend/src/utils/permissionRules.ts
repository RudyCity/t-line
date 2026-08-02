import type { PendingPermission } from '../components/SuperAgentInteractiveCards';

/**
 * Persistent rule-based auto-approval for SuperAgent permission prompts.
 * Stored per-workspace in localStorage. Pattern format:
 *   `tool:<toolName>`           — any call to toolName
 *   `tool:<toolName>:safe`      — read-only variants of toolName
 *
 * Examples:
 *   tool:read_file
 *   tool:search_code
 *   tool:glob_files
 */

const KEY_PREFIX = 'tline-permission-rules';

export interface AutoApproveRule {
  pattern: string;
  description?: string;
  createdAt: number;
}

function storageKey(workspace: string): string {
  return `${KEY_PREFIX}:${workspace.toLowerCase().replace(/\\/g, '/')}`;
}

export function loadRules(workspace: string): AutoApproveRule[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(workspace));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRules(workspace: string, rules: AutoApproveRule[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(workspace), JSON.stringify(rules));
  } catch {
    /* localStorage quota — silently drop */
  }
}

export function addRule(workspace: string, rule: AutoApproveRule): void {
  const rules = loadRules(workspace).filter((r) => r.pattern !== rule.pattern);
  rules.unshift(rule);
  saveRules(workspace, rules.slice(0, 50));
}

export function removeRule(workspace: string, pattern: string): void {
  const rules = loadRules(workspace).filter((r) => r.pattern !== pattern);
  saveRules(workspace, rules);
}

export function clearRules(workspace: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(storageKey(workspace));
}

/**
 * Tools considered read-only / non-destructive. These can be auto-approved
 * with the `tool:<name>:safe` pattern without prompting the user.
 */
export const SAFE_READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'read_file',
  'read_many_files',
  'search_code',
  'search_content',
  'grep_files',
  'glob_files',
  'list_files',
  'list_directory',
  'list_dir',
  'list_directory_tree',
  'get_file_info',
  'git_status',
  'git_log',
  'git_diff',
  'web_search',
  'web_fetch',
  'fetch_url',
]);

/**
 * Build an auto-approve pattern from a permission toolCall. Returns
 * `tool:<name>:safe` when the tool is in the read-only set, otherwise
 * `tool:<name>`.
 */
export function patternFromPermission(permission: PendingPermission): string {
  const toolName: string = permission?.toolCall?.tool || permission?.toolCall?.name || 'unknown';
  if (SAFE_READ_ONLY_TOOLS.has(toolName)) {
    return `tool:${toolName}:safe`;
  }
  return `tool:${toolName}`;
}

export function toolNameFromPermission(permission: PendingPermission): string {
  return permission?.toolCall?.tool || permission?.toolCall?.name || 'unknown';
}

/**
 * Check whether the permission matches any stored rule.
 */
export function matchesRule(permission: PendingPermission, rules: AutoApproveRule[]): boolean {
  const toolName = toolNameFromPermission(permission);
  if (!toolName || toolName === 'unknown') return false;
  for (const rule of rules) {
    if (rule.pattern === `tool:${toolName}`) return true;
    if (rule.pattern === `tool:${toolName}:safe` && SAFE_READ_ONLY_TOOLS.has(toolName)) return true;
  }
  return false;
}
