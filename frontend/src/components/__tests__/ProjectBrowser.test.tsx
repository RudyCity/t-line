// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectBrowser } from '../ProjectBrowser';

function jsonResponse(payload: any, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ProjectBrowser', () => {
  it('renders project states, hides catalog noise, and never asks for an MCP bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/superagent/projects/browser?')) {
        return jsonResponse({
          success: true,
          projects: [
            {
              catalogId: 'cat_1111111111111111', name: 'Discovered App', type: 'local',
              target: 'D:/apps/discovered', registered: false, discovered: true,
              unavailable: false, authorized: false, capabilities: [], sources: ['history'],
              active: false, sessionCount: 12, classification: 'project',
              requiresManualProfile: false, rejectionReasons: [],
            },
            {
              catalogId: 'cat_2222222222222222', name: 'Registered App', type: 'local',
              target: 'D:/apps/registered', registered: true, registeredProjectId: 'registered-app',
              enabled: true, discovered: false, unavailable: false, authorized: false,
              capabilities: [], sources: ['registry'], active: true, sessionCount: 3,
              classification: 'project', requiresManualProfile: false, rejectionReasons: [],
            },
            {
              catalogId: 'cat_3333333333333333', name: 'Deleted Worktree', type: 'local',
              target: 'D:/apps/.worktrees/wt_1', registered: false, discovered: false,
              unavailable: true, authorized: false, capabilities: [], sources: ['history'],
              active: false, sessionCount: 1, classification: 'worktree',
              requiresManualProfile: false, rejectionReasons: ['worktree'],
            },
          ],
          identities: [],
          selectedIdentityHandle: null,
          total: 3,
          limit: 100,
          offset: 0,
        }) as any;
      }
      if (url.endsWith('/import')) {
        return jsonResponse({ success: true, capabilitiesGranted: false }) as any;
      }
      return jsonResponse({ success: false, error: 'unexpected' }, 500) as any;
    });

    render(<ProjectBrowser />);

    await screen.findByText('Discovered App');
    expect(screen.getByText('Registered App')).toBeTruthy();
    expect(screen.queryByText('Deleted Worktree')).toBeNull();
    expect(screen.getByText(/Connect an MCP client before granting/i)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /token|bearer/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) =>
        String(url).endsWith('/api/superagent/projects/browser/import') &&
        (init as RequestInit | undefined)?.method === 'POST'
      )).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Registered' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('filter=registered'))).toBe(true);
    });
  });

  it('grants explicit capabilities only to a selected sanitized MCP identity', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/superagent/projects/browser?')) {
        return jsonResponse({
          success: true,
          projects: [{
            catalogId: 'cat_4444444444444444', name: 'Secure App', type: 'local',
            target: 'D:/apps/secure', registered: true, registeredProjectId: 'secure-app',
            enabled: true, discovered: false, unavailable: false, authorized: false,
            capabilities: [], sources: ['registry'], active: false, sessionCount: 5,
            classification: 'project', requiresManualProfile: false, rejectionReasons: [],
          }],
          identities: [{
            identityHandle: 'idh_0123456789abcdef',
            mode: 'oauth',
            subject: 'desktop-client',
            scopes: ['read'],
            lastSeenAt: Date.now(),
          }],
          selectedIdentityHandle: 'idh_0123456789abcdef',
          total: 1,
          limit: 100,
          offset: 0,
        }) as any;
      }
      if (url.endsWith('/grant')) {
        return jsonResponse({ success: true, grant: { projectId: 'secure-app', capabilities: ['read'] } }) as any;
      }
      return jsonResponse({ success: false }, 500) as any;
    });

    render(<ProjectBrowser />);
    await screen.findByText('Secure App');

    fireEvent.click(screen.getByRole('button', { name: /Grant/i }));
    expect(screen.getByText('Confirm Grant')).toBeTruthy();
    fireEvent.click(screen.getByText('Confirm Grant'));

    await waitFor(() => {
      const grantCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/grant'));
      expect(grantCall).toBeTruthy();
      const body = JSON.parse(String((grantCall?.[1] as RequestInit | undefined)?.body));
      expect(body).toEqual({
        projectId: 'secure-app',
        identityHandle: 'idh_0123456789abcdef',
        capabilities: ['read'],
      });
      expect(JSON.stringify(body)).not.toContain('credentialHash');
      expect(JSON.stringify(body)).not.toContain('bearerToken');
    });
  });
});
