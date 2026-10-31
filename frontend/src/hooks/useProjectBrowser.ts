import { useCallback, useEffect, useMemo, useState } from 'react';

export type ProjectBrowserFilter = 'all' | 'registered' | 'discovered' | 'active' | 'unavailable';
export type ProjectCapability = 'read' | 'write' | 'execute' | 'git' | 'worktree' | 'planning' | 'chain';

export interface ProjectBrowserIdentity {
  identityHandle: string;
  mode: 'oauth' | 'static-bearer';
  subject: string;
  scopes: string[];
  lastSeenAt: number;
}

export interface ProjectBrowserProject {
  catalogId: string;
  name: string;
  type: 'local' | 'ssh' | 'chain';
  target: string;
  registered: boolean;
  registeredProjectId?: string;
  enabled?: boolean;
  discovered: boolean;
  unavailable: boolean;
  authorized: boolean;
  capabilities: ProjectCapability[];
  sources: string[];
  active: boolean;
  sessionCount: number;
  classification: string;
  importable?: boolean;
  requiresManualProfile: boolean;
  rejectionReasons: string[];
  lastUsedAt?: number;
}

interface ProjectBrowserResponse {
  success?: boolean;
  projects?: ProjectBrowserProject[];
  identities?: ProjectBrowserIdentity[];
  selectedIdentityHandle?: string | null;
  total?: number;
  limit?: number;
  offset?: number;
  error?: string;
}

function authHeaders(json = false): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

function notify(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('tline-toast', { detail: { message, type } }));
}

async function parseResponse(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Project Browser request failed.');
  }
  return payload;
}

export function useProjectBrowser() {
  const [filter, setFilter] = useState<ProjectBrowserFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedIdentityHandle, setSelectedIdentityHandle] = useState('');
  const [projects, setProjects] = useState<ProjectBrowserProject[]>([]);
  const [identities, setIdentities] = useState<ProjectBrowserIdentity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () => projects.filter(project => !['worktree', 'temporary', 'test-fixture'].includes(project.classification)),
    [projects],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ filter, limit: '100', offset: '0' });
      if (query.trim()) params.set('query', query.trim());
      if (selectedIdentityHandle) params.set('identityHandle', selectedIdentityHandle);
      const response = await fetch('/api/superagent/projects/browser?' + params.toString(), {
        headers: authHeaders(),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await parseResponse(response) as ProjectBrowserResponse;
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      setIdentities(Array.isArray(data.identities) ? data.identities : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      if (!selectedIdentityHandle && data.selectedIdentityHandle) {
        setSelectedIdentityHandle(data.selectedIdentityHandle);
      }
    } catch (e: any) {
      const message = e?.message || 'Unable to load MCP projects.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filter, query, selectedIdentityHandle]);

  useEffect(() => { void load(); }, [load]);

  const mutate = useCallback(async (
    key: string,
    path: string,
    method: 'POST' | 'DELETE',
    body?: Record<string, unknown>,
    successMessage?: string,
  ) => {
    setMutatingKey(key);
    setError(null);
    try {
      const response = await fetch('/api/superagent/projects/browser' + path, {
        method,
        headers: authHeaders(body !== undefined),
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await parseResponse(response);
      if (successMessage) notify(successMessage);
      await load();
      return data;
    } catch (e: any) {
      const message = e?.message || 'Project Browser action failed.';
      setError(message);
      notify(message, 'error');
      throw e;
    } finally {
      setMutatingKey(null);
    }
  }, [load]);

  const registerProject = useCallback(
    (project: ProjectBrowserProject) =>
      mutate(project.catalogId, '/import', 'POST', { catalogId: project.catalogId }, 'Project registered.'),
    [mutate],
  );

  const grantProject = useCallback(
    (projectId: string, capabilities: ProjectCapability[]) => {
      if (!selectedIdentityHandle) throw new Error('Connect an MCP client before granting access.');
      return mutate(
        projectId,
        '/grant',
        'POST',
        { projectId, identityHandle: selectedIdentityHandle, capabilities },
        'Project access granted.',
      );
    },
    [mutate, selectedIdentityHandle],
  );

  const revokeProject = useCallback(
    (projectId: string) => {
      if (!selectedIdentityHandle) throw new Error('Select an MCP identity first.');
      return mutate(
        projectId,
        '/revoke',
        'POST',
        { projectId, identityHandle: selectedIdentityHandle },
        'Project access revoked.',
      );
    },
    [mutate, selectedIdentityHandle],
  );

  const setProjectEnabled = useCallback(
    (projectId: string, enabled: boolean) =>
      mutate(
        projectId,
        '/disable',
        'POST',
        { projectId, enabled },
        enabled ? 'Project enabled.' : 'Project disabled and grants revoked.',
      ),
    [mutate],
  );

  const removeProject = useCallback(
    (projectId: string) =>
      mutate(projectId, '/' + encodeURIComponent(projectId), 'DELETE', undefined, 'Project registration removed.'),
    [mutate],
  );

  return {
    filter,
    setFilter,
    query,
    setQuery,
    projects: visibleProjects,
    identities,
    selectedIdentityHandle,
    setSelectedIdentityHandle,
    total,
    loading,
    mutatingKey,
    error,
    refresh: load,
    registerProject,
    grantProject,
    revokeProject,
    setProjectEnabled,
    removeProject,
  };
}
