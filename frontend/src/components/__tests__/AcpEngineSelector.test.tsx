// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AcpEngineSelector } from '../AcpEngineSelector';

describe('AcpEngineSelector - Multi-Core Switcher Pill & Dropdown', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders active engine trigger pill with badge', () => {
    render(
      <AcpEngineSelector
        currentEngineId="superagent"
        onEngineSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Superagent Core')).toBeDefined();
    expect(screen.getByText('ACP v1.0')).toBeDefined();
  });

  it('opens dropdown menu on click displaying all engines', () => {
    render(
      <AcpEngineSelector
        currentEngineId="superagent"
        onEngineSelect={vi.fn()}
      />
    );

    // Initial state: menu not open
    expect(screen.queryByRole('menu')).toBeNull();

    // Click trigger
    const trigger = screen.getByRole('button', { name: /Select ACP Engine/i });
    fireEvent.click(trigger);

    // Menu is opened
    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getByText('ACP Pluggable Core')).toBeDefined();
    expect(screen.getByText('Antigravity (Gemini)')).toBeDefined();
    expect(screen.getByText('Codex Bridge')).toBeDefined();
  });

  it('calls onEngineSelect and closes menu when selecting a new engine', () => {
    const onSelect = vi.fn();
    render(
      <AcpEngineSelector
        currentEngineId="superagent"
        onEngineSelect={onSelect}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /Select ACP Engine/i });
    fireEvent.click(trigger);

    // Click Antigravity
    const antigravityBtn = screen.getByText('Antigravity (Gemini)').closest('button');
    expect(antigravityBtn).toBeDefined();
    if (antigravityBtn) {
      fireEvent.click(antigravityBtn);
    }

    expect(onSelect).toHaveBeenCalledWith('antigravity');
    // Menu closes
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes dropdown when Escape key is pressed', () => {
    render(
      <AcpEngineSelector
        currentEngineId="superagent"
        onEngineSelect={vi.fn()}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /Select ACP Engine/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeDefined();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
