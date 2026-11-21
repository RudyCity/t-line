/**
 * Agent Client Protocol (ACP) - ADE MCP Auto-Provisioner for T-Line
 * Automatically provisions and syncs Superagent MCP server configuration into
 * third-party ADE engines (OpenCode, Cline, Claude Code) so that they have immediate
 * access to Superagent Dynamic Tools without manual configuration.
 */

import fs from 'fs';
import path from 'path';

export interface ProvisionResult {
  opencodeProvisioned: boolean;
  clineProvisioned: boolean;
  claudeProvisioned: boolean;
  superAgentCliPath: string;
}

/**
 * Resolves the canonical path to Superagent CLI for MCP server registration.
 */
export function getSuperAgentCliPath(): string {
  // Check sibling workspace checkout first
  const siblingCli = path.resolve(__dirname, '../../../superagent/dist/cli.js');
  if (fs.existsSync(siblingCli)) {
    return siblingCli;
  }
  return 'superagent';
}

/**
 * Ensures OpenCode has Superagent MCP configured in `opencode.json` at the workspace root.
 */
export function provisionOpencodeMcp(workspacePath: string, cliPath = getSuperAgentCliPath()): boolean {
  if (!workspacePath) return false;
  try {
    const configPath = path.join(workspacePath, 'opencode.json');
    let config: any = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {}
    }

    if (!config.mcp) config.mcp = {};
    const command = cliPath.endsWith('.js') ? ['bun', cliPath, '--mcp'] : [cliPath, '--mcp'];

    config.mcp.superagent = {
      type: 'local',
      command,
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[ACP-Provisioner] Failed to provision opencode.json:', err);
    return false;
  }
}

/**
 * Ensures Cline has Superagent MCP configured in `cline_mcp_settings.json`.
 */
export function provisionClineMcp(cliPath = getSuperAgentCliPath()): boolean {
  try {
    const appData = process.env.APPDATA || '';
    const userProfile = process.env.USERPROFILE || '';

    // Primary Cline locations
    const candidateDirs = [
      path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings'),
      path.join(userProfile, '.cline'),
    ];

    let success = false;
    const command = cliPath.endsWith('.js') ? 'bun' : cliPath;
    const args = cliPath.endsWith('.js') ? [cliPath, '--mcp'] : ['--mcp'];

    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        const settingsPath = path.join(dir, 'cline_mcp_settings.json');
        let settings: any = { mcpServers: {} };
        if (fs.existsSync(settingsPath)) {
          try {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          } catch {}
        }
        if (!settings.mcpServers) settings.mcpServers = {};
        settings.mcpServers.superagent = {
          command,
          args,
          disabled: false,
          autoApprove: ['superagent_tool_search', 'superagent_tool_describe'],
        };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        success = true;
      }
    }
    return success;
  } catch (err) {
    console.warn('[ACP-Provisioner] Failed to provision cline_mcp_settings.json:', err);
    return false;
  }
}

/**
 * Provisions Superagent MCP into all relevant ADE engines before session start.
 */
export function provisionAllAdeMcp(workspacePath: string): ProvisionResult {
  const cliPath = getSuperAgentCliPath();
  const opencodeProvisioned = provisionOpencodeMcp(workspacePath, cliPath);
  const clineProvisioned = provisionClineMcp(cliPath);

  return {
    opencodeProvisioned,
    clineProvisioned,
    claudeProvisioned: false,
    superAgentCliPath: cliPath,
  };
}
