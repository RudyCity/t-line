import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SplitLayoutNode, TerminalInstanceData, ActiveProcessSummary } from '../hooks/useTerminals';
import { TerminalInstance } from './TerminalInstance';
import { Trash2 } from 'lucide-react';

export interface SplitLayoutRendererProps {
  node: SplitLayoutNode;
  activeTabId: string;
  focusedTerminalId?: string;
  wsConnected: boolean;
  terminalFontSize: number;
  terminalInstances: Record<string, TerminalInstanceData>;
  handleTitleChange: (id: string, title: string) => void;
  handleActiveProcessesChange?: (id: string, processes: ActiveProcessSummary[]) => void;
  focusTerminal: (id: string) => void;
  closePane: (id: string) => void;
  splitFocusedTerminal: (direction: 'horizontal' | 'vertical') => void;
  hasMultiplePanes: boolean;
  onTerminalFocus?: () => void;
  refreshTriggers?: Record<string, number>;
  fontFamily?: string;
  fontWeight?: string;
  accentColor?: string;
  themeBackground?: string;
  themeForeground?: string;
  clearInitialCommand?: (id: string) => void;
  defaultShell?: string;
  setDefaultShell?: (val: string) => void;
  handleZoomIn?: () => void;
  handleZoomOut?: () => void;
  onRefreshTerminal?: (id: string) => void;
  onLayoutChange?: (newNode: SplitLayoutNode) => void;
}

// ─── LeafPane ─────────────────────────────────────────────────────────────────
// Separate component so we can use useState for mobile toggle without hooks-in-loop
interface LeafPaneProps {
  term: TerminalInstanceData;
  activeTabId: string;
  isFocused: boolean;
  wsConnected: boolean;
  terminalFontSize: number;
  terminalId: string;
  handleTitleChange: (id: string, title: string) => void;
  handleActiveProcessesChange?: (id: string, processes: ActiveProcessSummary[]) => void;
  focusTerminal: (id: string) => void;
  closePane: (id: string) => void;
  splitFocusedTerminal: (direction: 'horizontal' | 'vertical') => void;
  hasMultiplePanes: boolean;
  onTerminalFocus?: () => void;
  refreshTriggers?: Record<string, number>;
  fontFamily?: string;
  fontWeight?: string;
  accentColor?: string;
  themeBackground?: string;
  themeForeground?: string;
  clearInitialCommand?: (id: string) => void;
  defaultShell?: string;
  setDefaultShell?: (val: string) => void;
  handleZoomIn?: () => void;
  handleZoomOut?: () => void;
  onRefreshTerminal?: (id: string) => void;
}

function LeafPane({
  term,
  activeTabId,
  isFocused,
  wsConnected,
  terminalFontSize,
  terminalId,
  handleTitleChange,
  handleActiveProcessesChange,
  focusTerminal,
  closePane,
  splitFocusedTerminal,
  hasMultiplePanes,
  onTerminalFocus,
  refreshTriggers,
  fontFamily,
  fontWeight,
  accentColor,
  themeBackground,
  themeForeground,
  clearInitialCommand,
  defaultShell,
  setDefaultShell,
  handleZoomIn,
  handleZoomOut,
  onRefreshTerminal,
}: LeafPaneProps): React.JSX.Element {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      onClick={() => {
        focusTerminal(terminalId);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        border: 'none',
        background: 'transparent',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      className="group/pane"
    >
      <TerminalInstance
        key={term.id}
        tab={term as any}
        active={!!activeTabId}
        wsConnected={wsConnected}
        fontSize={terminalFontSize}
        onTitleChange={(title) => handleTitleChange(term.id, title)}
        onActiveProcessesChange={(processes) => handleActiveProcessesChange?.(term.id, processes)}
        onFocus={() => {
          focusTerminal(terminalId);
          onTerminalFocus?.();
        }}
        refreshTrigger={refreshTriggers?.[term.id] || 0}
        isFocusedPane={isFocused && hasMultiplePanes}
        disableAutoFocus={!isFocused}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        accentColor={accentColor}
        themeBackground={themeBackground}
        themeForeground={themeForeground}
        onClearInitialCommand={clearInitialCommand}
        defaultShell={defaultShell}
        setDefaultShell={setDefaultShell}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        onRefreshTerminal={onRefreshTerminal}
      />

      {/* ── Desktop: hover action bar (top-right, hidden until hover) ── */}
      <div
        className="absolute top-2 right-2 hidden lg:flex items-center gap-1 opacity-0 group-hover/pane:opacity-100 transition-opacity duration-200 z-50 backdrop-blur-md border border-[var(--r-ui-color-border-standard)] rounded-md p-1 bg-[var(--r-ui-color-surface)]/90 shadow-[var(--r-ui-shadow-sm)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title="Split Horizontal (Alt+D)"
          onClick={() => splitFocusedTerminal('horizontal')}
          className="w-5 h-5 rounded p-1 transition-colors flex items-center justify-center cursor-pointer text-[var(--r-ui-color-text-secondary)] hover:text-[var(--r-ui-color-accent-primary)] hover:bg-[var(--r-ui-color-surface-elevated)]"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
            <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm6.5 1v8h1V4z" />
          </svg>
        </button>
        <button
          type="button"
          title="Split Vertical (Alt+E)"
          onClick={() => splitFocusedTerminal('vertical')}
          className="w-5 h-5 rounded p-1 transition-colors flex items-center justify-center cursor-pointer text-[var(--r-ui-color-text-secondary)] hover:text-[var(--r-ui-color-accent-primary)] hover:bg-[var(--r-ui-color-surface-elevated)]"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
            <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm1 5.5h12v-1H2z" />
          </svg>
        </button>
        {hasMultiplePanes && (
          <button
            type="button"
            title="Close Pane (Alt+W)"
            onClick={() => closePane(terminalId)}
            className="w-5 h-5 rounded p-1 transition-colors flex items-center justify-center cursor-pointer text-[var(--r-ui-color-text-secondary)] hover:text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 size={12} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* ── Mobile/Tablet: compact toggle button at top-right ── */}
      <div
        className="absolute top-2 right-2 flex lg:hidden z-50"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Expanded actions – slide in when toggled */}
        {mobileMenuOpen && (
          <div className="flex items-center gap-1 mr-1.5 backdrop-blur-md border border-[var(--r-ui-color-border-standard)] rounded-md px-1.5 py-1 bg-[var(--r-ui-color-surface)]/90 shadow-[var(--r-ui-shadow-sm)]">
            <button
              type="button"
              title="Split Horizontal"
              onClick={() => { splitFocusedTerminal('horizontal'); setMobileMenuOpen(false); }}
              className="w-7 h-7 rounded p-1.5 transition-colors flex items-center justify-center cursor-pointer text-[var(--r-ui-color-text-secondary)] hover:text-[var(--r-ui-color-accent-primary)] hover:bg-[var(--r-ui-color-surface-elevated)]"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm6.5 1v8h1V4z" />
              </svg>
            </button>
            <button
              type="button"
              title="Split Vertical"
              onClick={() => { splitFocusedTerminal('vertical'); setMobileMenuOpen(false); }}
              className="w-7 h-7 rounded p-1.5 transition-colors flex items-center justify-center cursor-pointer text-[var(--r-ui-color-text-secondary)] hover:text-[var(--r-ui-color-accent-primary)] hover:bg-[var(--r-ui-color-surface-elevated)]"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm1 5.5h12v-1H2z" />
              </svg>
            </button>
            {hasMultiplePanes && (
              <button
                type="button"
                title="Close Pane"
                onClick={() => { closePane(terminalId); setMobileMenuOpen(false); }}
                className="w-7 h-7 rounded p-1.5 transition-colors flex items-center justify-center cursor-pointer text-[var(--r-ui-color-text-secondary)] hover:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 size={14} strokeWidth={2.2} />
              </button>
            )}
          </div>
        )}

        {/* Toggle pill button */}
        <button
          type="button"
          title={mobileMenuOpen ? 'Close menu' : 'Terminal actions'}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 cursor-pointer border ${
            mobileMenuOpen
              ? 'bg-[var(--r-ui-color-accent-subtle)] text-[var(--r-ui-color-accent-primary)] border-[var(--r-ui-color-accent-primary)]/40'
              : 'bg-[var(--r-ui-color-surface)]/80 text-[var(--r-ui-color-text-secondary)] border-[var(--r-ui-color-border-subtle)] hover:text-[var(--r-ui-color-text-primary)]'
          }`}
        >
          {mobileMenuOpen ? (
            /* X icon */
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          ) : (
            /* Split icon (dots grid / pane icon) */
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
              <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm6.5 1v8h1V4z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── SplitLayoutRenderer ──────────────────────────────────────────────────────
export function SplitLayoutRenderer({
  node,
  activeTabId,
  focusedTerminalId,
  wsConnected,
  terminalFontSize,
  terminalInstances,
  handleTitleChange,
  handleActiveProcessesChange,
  focusTerminal,
  closePane,
  splitFocusedTerminal,
  hasMultiplePanes,
  onTerminalFocus,
  refreshTriggers,
  fontFamily,
  fontWeight,
  accentColor,
  themeBackground,
  themeForeground,
  clearInitialCommand,
  defaultShell,
  setDefaultShell,
  handleZoomIn,
  handleZoomOut,
  onRefreshTerminal,
  onLayoutChange
}: SplitLayoutRendererProps): React.JSX.Element | null {
  if (node.type === 'leaf') {
    const term = terminalInstances[node.terminalId];
    if (!term) return null;
    const isFocused = focusedTerminalId === node.terminalId;

    return (
      <LeafPane
        term={term}
        activeTabId={activeTabId}
        isFocused={isFocused}
        wsConnected={wsConnected}
        terminalFontSize={terminalFontSize}
        handleTitleChange={handleTitleChange}
        handleActiveProcessesChange={handleActiveProcessesChange}
        focusTerminal={focusTerminal}
        closePane={closePane}
        splitFocusedTerminal={splitFocusedTerminal}
        hasMultiplePanes={hasMultiplePanes}
        onTerminalFocus={onTerminalFocus}
        refreshTriggers={refreshTriggers}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        accentColor={accentColor}
        themeBackground={themeBackground}
        themeForeground={themeForeground}
        clearInitialCommand={clearInitialCommand}
        terminalId={node.terminalId}
        defaultShell={defaultShell}
        setDefaultShell={setDefaultShell}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        onRefreshTerminal={onRefreshTerminal}
      />
    );
  }

  const handleLayoutChange = (sizes: number[]) => {
    if (sizes.length === 2 && onLayoutChange) {
      onLayoutChange({
        ...node,
        firstSize: sizes[0],
        secondSize: sizes[1]
      } as SplitLayoutNode);
    }
  };

  return (
    <PanelGroup direction={node.direction} onLayout={handleLayoutChange}>
      <Panel defaultSize={node.firstSize ?? 50}>
        <SplitLayoutRenderer
          node={node.first}
          activeTabId={activeTabId}
          focusedTerminalId={focusedTerminalId}
          wsConnected={wsConnected}
          terminalFontSize={terminalFontSize}
          terminalInstances={terminalInstances}
          handleTitleChange={handleTitleChange}
          handleActiveProcessesChange={handleActiveProcessesChange}
          focusTerminal={focusTerminal}
          closePane={closePane}
          splitFocusedTerminal={splitFocusedTerminal}
          hasMultiplePanes={hasMultiplePanes}
          onTerminalFocus={onTerminalFocus}
          refreshTriggers={refreshTriggers}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          accentColor={accentColor}
          themeBackground={themeBackground}
          themeForeground={themeForeground}
          clearInitialCommand={clearInitialCommand}
          defaultShell={defaultShell}
          setDefaultShell={setDefaultShell}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          onRefreshTerminal={onRefreshTerminal}
          onLayoutChange={(newFirst) => {
            if (onLayoutChange) {
              onLayoutChange({
                ...node,
                first: newFirst
              });
            }
          }}
        />
      </Panel>
      <PanelResizeHandle
        className="transition-colors flex-shrink-0 bg-[var(--r-ui-color-border-subtle)] hover:bg-[var(--r-ui-color-accent-primary)]/60"
        style={{
          width: node.direction === 'horizontal' ? '4px' : '100%',
          height: node.direction === 'vertical' ? '4px' : '100%',
          cursor: node.direction === 'horizontal' ? 'col-resize' : 'row-resize',
        }}
      />
      <Panel defaultSize={node.secondSize ?? 50}>
        <SplitLayoutRenderer
          node={node.second}
          activeTabId={activeTabId}
          focusedTerminalId={focusedTerminalId}
          wsConnected={wsConnected}
          terminalFontSize={terminalFontSize}
          terminalInstances={terminalInstances}
          handleTitleChange={handleTitleChange}
          handleActiveProcessesChange={handleActiveProcessesChange}
          focusTerminal={focusTerminal}
          closePane={closePane}
          splitFocusedTerminal={splitFocusedTerminal}
          hasMultiplePanes={hasMultiplePanes}
          onTerminalFocus={onTerminalFocus}
          refreshTriggers={refreshTriggers}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          accentColor={accentColor}
          themeBackground={themeBackground}
          themeForeground={themeForeground}
          clearInitialCommand={clearInitialCommand}
          defaultShell={defaultShell}
          setDefaultShell={setDefaultShell}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          onRefreshTerminal={onRefreshTerminal}
          onLayoutChange={(newSecond) => {
            if (onLayoutChange) {
              onLayoutChange({
                ...node,
                second: newSecond
              });
            }
          }}
        />
      </Panel>
    </PanelGroup>
  );
}
