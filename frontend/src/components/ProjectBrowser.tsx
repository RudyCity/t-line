import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Unplug,
  Wifi,
} from 'lucide-react';
import {
  ProjectBrowserFilter,
  ProjectBrowserProject,
  ProjectCapability,
  useProjectBrowser,
} from '../hooks/useProjectBrowser';

const FILTERS: Array<{ id: ProjectBrowserFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'registered', label: 'Registered' },
  { id: 'discovered', label: 'Discovered' },
  { id: 'active', label: 'Active' },
  { id: 'unavailable', label: 'Unavailable' },
];

const CAPABILITIES: ProjectCapability[] = [
  'read', 'write', 'execute', 'git', 'worktree', 'planning', 'chain',
];

function primaryStatus(project: ProjectBrowserProject) {
  if (project.unavailable) return { label: 'Unavailable', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/25' };
  if (project.registered && project.authorized) return { label: 'Authorized', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' };
  if (project.registered) return { label: 'Registered', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/25' };
  return { label: 'Discovered', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' };
}

function shortIdentity(subject: string, mode: string) {
  return mode === 'static-bearer' ? 'Bearer client' : subject;
}

export function ProjectBrowser() {
  const browser = useProjectBrowser();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [grantProjectId, setGrantProjectId] = useState<string | null>(null);
  const [grantCaps, setGrantCaps] = useState<Set<ProjectCapability>>(new Set(['read']));

  const selectedIdentity = useMemo(
    () => browser.identities.find(identity => identity.identityHandle === browser.selectedIdentityHandle) || null,
    [browser.identities, browser.selectedIdentityHandle],
  );

  const toggleCapability = (capability: ProjectCapability) => {
    setGrantCaps(prev => {
      const next = new Set(prev);
      next.has(capability) ? next.delete(capability) : next.add(capability);
      return next;
    });
  };

  const projectActionId = (project: ProjectBrowserProject) => project.registeredProjectId || project.catalogId;

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden" data-testid="mcp-project-browser">
      <div className="px-3 pb-2 space-y-2 border-b border-[var(--border-color)]">
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => browser.setFilter(item.id)}
              className={
                'text-[10px] px-2 py-1 rounded border whitespace-nowrap transition-colors ' +
                (browser.filter === item.id
                  ? 'text-[var(--color-primary)] border-[var(--color-primary)]/40 bg-[var(--color-primary-glow)]'
                  : 'text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]')
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2 top-2 text-[var(--text-muted)]" />
          <input
            aria-label="Search MCP projects"
            value={browser.query}
            onChange={event => browser.setQuery(event.target.value)}
            placeholder="Search projects…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-[var(--border-color)] bg-[var(--surface-overlay)] text-[var(--text-main)] outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="MCP identity"
            value={browser.selectedIdentityHandle}
            onChange={event => browser.setSelectedIdentityHandle(event.target.value)}
            className="min-w-0 flex-1 text-[10px] px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--surface-overlay)] text-[var(--text-main)]"
          >
            <option value="">No MCP identity</option>
            {browser.identities.map(identity => (
              <option key={identity.identityHandle} value={identity.identityHandle}>
                {shortIdentity(identity.subject, identity.mode)}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Refresh MCP projects"
            className="action-btn"
            onClick={() => void browser.refresh()}
            disabled={browser.loading}
          >
            <RefreshCw size={13} className={browser.loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {!selectedIdentity && (
          <div className="text-[10px] leading-4 text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 flex gap-1.5">
            <Unplug size={12} className="mt-0.5 shrink-0" />
            <span>Connect an MCP client before granting or revoking project access. No bearer token is entered here.</span>
          </div>
        )}

        {browser.error && (
          <div role="alert" className="text-[10px] leading-4 text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded px-2 py-1.5">
            {browser.error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2">
        {browser.loading && browser.projects.length === 0 && (
          <div className="py-8 flex items-center justify-center text-[var(--text-muted)] text-xs gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading MCP projects…
          </div>
        )}

        {!browser.loading && browser.projects.length === 0 && (
          <div className="py-8 text-center text-[11px] text-[var(--text-muted)]">
            No MCP projects match this filter.
          </div>
        )}

        {browser.projects.map(project => {
          const status = primaryStatus(project);
          const expanded = expandedId === project.catalogId;
          const actionId = projectActionId(project);
          const busy = browser.mutatingKey === actionId || browser.mutatingKey === project.catalogId;
          const granting = grantProjectId === actionId;

          return (
            <div
              key={project.catalogId}
              className="rounded-md border border-[var(--border-color)] bg-[var(--surface-overlay)] overflow-hidden"
              data-classification={project.classification}
            >
              <div className="p-2.5">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-label={expanded ? 'Collapse project details' : 'Inspect project'}
                    onClick={() => setExpandedId(expanded ? null : project.catalogId)}
                    className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-xs font-semibold text-[var(--text-main)]" title={project.name}>
                        {project.name}
                      </span>
                      <span className={'text-[9px] px-1.5 py-0.5 rounded border ' + status.cls}>{status.label}</span>
                      {project.active && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border text-violet-300 bg-violet-500/10 border-violet-500/25 flex items-center gap-1">
                          <Wifi size={8} /> Active
                        </span>
                      )}
                      {project.registered && project.enabled === false && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border text-[var(--r-ui-color-text-tertiary)] border-[var(--r-ui-color-border-subtle)]">Disabled</span>
                      )}
                    </div>
                    <div className="mt-1 text-[9px] text-[var(--text-muted)]">
                      {project.sessionCount} sessions · {project.type} · {project.sources.join(', ') || 'catalog'}
                    </div>
                  </div>
                </div>

                {project.requiresManualProfile && (
                  <div className="mt-2 text-[9px] text-amber-300 flex items-center gap-1">
                    <KeyRound size={10} /> SSH profile setup is required before remote use.
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  {project.discovered && !project.unavailable && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void browser.registerProject(project)}
                      className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      Register
                    </button>
                  )}

                  {project.registered && !project.authorized && project.enabled !== false && (
                    <button
                      type="button"
                      disabled={!selectedIdentity || busy}
                      onClick={() => {
                        setGrantProjectId(granting ? null : actionId);
                        setGrantCaps(new Set(['read']));
                      }}
                      className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
                    >
                      <ShieldCheck size={10} className="inline mr-1" /> Grant
                    </button>
                  )}

                  {project.registered && project.authorized && (
                    <button
                      type="button"
                      disabled={!selectedIdentity || busy}
                      onClick={() => {
                        if (window.confirm('Revoke this MCP identity\'s access to the project?')) {
                          void browser.revokeProject(actionId);
                        }
                      }}
                      className="text-[10px] px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                    >
                      <ShieldOff size={10} className="inline mr-1" /> Revoke
                    </button>
                  )}

                  {project.registered && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = project.enabled === false;
                          if (window.confirm(next ? 'Enable this MCP project?' : 'Disable this MCP project and revoke all grants?')) {
                            void browser.setProjectEnabled(actionId, next);
                          }
                        }}
                        className="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40"
                      >
                        {project.enabled === false ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('Remove this MCP project registration? Project files will not be deleted.')) {
                            void browser.removeProject(actionId);
                          }
                        }}
                        className="text-[10px] px-2 py-1 rounded border border-rose-500/20 text-rose-300/90 hover:bg-rose-500/10 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>

                {granting && selectedIdentity && (
                  <div className="mt-2 p-2 rounded border border-emerald-500/20 bg-emerald-500/5">
                    <div className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Capabilities</div>
                    <div className="flex flex-wrap gap-1">
                      {CAPABILITIES.map(capability => (
                        <label key={capability} className="flex items-center gap-1 text-[9px] text-[var(--text-main)] px-1.5 py-1 rounded border border-[var(--border-color)]">
                          <input
                            type="checkbox"
                            checked={grantCaps.has(capability)}
                            onChange={() => toggleCapability(capability)}
                          />
                          {capability}
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        disabled={grantCaps.size === 0 || busy}
                        onClick={() => {
                          if (window.confirm('Grant the selected capabilities to this MCP identity?')) {
                            void browser.grantProject(actionId, [...grantCaps]).then(() => setGrantProjectId(null));
                          }
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-emerald-600/80 text-white disabled:opacity-40"
                      >
                        Confirm Grant
                      </button>
                      <button
                        type="button"
                        onClick={() => setGrantProjectId(null)}
                        className="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {expanded && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-color)] text-[9px] text-[var(--text-muted)] space-y-1 break-all">
                    <div><span className="font-semibold text-[var(--text-main)]">Target:</span> {project.target}</div>
                    <div><span className="font-semibold text-[var(--text-main)]">Catalog:</span> {project.catalogId}</div>
                    {project.registeredProjectId && (
                      <div><span className="font-semibold text-[var(--text-main)]">Project ID:</span> {project.registeredProjectId}</div>
                    )}
                    {project.capabilities.length > 0 && (
                      <div><span className="font-semibold text-[var(--text-main)]">Access:</span> {project.capabilities.join(', ')}</div>
                    )}
                    {project.rejectionReasons.length > 0 && (
                      <div><span className="font-semibold text-[var(--text-main)]">Notes:</span> {project.rejectionReasons.join('; ')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-[var(--border-color)] text-[9px] text-[var(--text-muted)]">
        {browser.total} catalog entries
      </div>
    </div>
  );
}
