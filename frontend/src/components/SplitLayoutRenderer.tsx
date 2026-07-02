import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SplitLayoutNode, TerminalInstanceData, ActiveProcessSummary } from '../hooks/useTerminals';
import { TerminalInstance } from './TerminalInstance';

// Helper to detect if a background color is light/bright
function isLightColor(color: string | undefined): boolean {
  if (!color) return false;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    }
  }
  return false;
}

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
}

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
  clearInitialCommand
}: SplitLayoutRendererProps): React.JSX.Element | null {
  if (node.type === 'leaf') {
    const term = terminalInstances[node.terminalId];
    if (!term) return null;
    const isFocused = focusedTerminalId === node.terminalId;

    return (
      <div 
        onClick={() => focusTerminal(node.terminalId)}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          border: 'none',
          background: 'transparent',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
        className="group/pane"
      >
        <TerminalInstance
          tab={term as any}
          active={!!(activeTabId && isFocused)}
          wsConnected={wsConnected}
          fontSize={terminalFontSize}
          onTitleChange={(title) => handleTitleChange(term.id, title)}
          onActiveProcessesChange={(processes) => handleActiveProcessesChange?.(term.id, processes)}
          onFocus={() => {
            focusTerminal(node.terminalId);
            onTerminalFocus?.();
          }}
          refreshTrigger={refreshTriggers?.[term.id] || 0}
          isFocusedPane={isFocused && hasMultiplePanes}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          accentColor={accentColor}
          themeBackground={themeBackground}
          themeForeground={themeForeground}
          onClearInitialCommand={clearInitialCommand}
        />
        
        {/* Floating action bar at top-right of each pane */}
        <div 
          className={`absolute bottom-2 right-2 top-auto lg:top-2 lg:right-2 lg:bottom-auto flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover/pane:opacity-100 transition-opacity duration-200 z-50 backdrop-blur-md border rounded-md p-1.5 lg:p-1 shadow-lg ${
            isLightColor(themeBackground) 
              ? 'bg-white/85 border-purple-300/40 shadow-sm' 
              : 'bg-[#0f111a]/85 border-purple-500/25'
          }`}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Split Horizontal (Alt+D)"
            onClick={() => splitFocusedTerminal('horizontal')}
            className={`w-7 h-7 lg:w-5 lg:h-5 rounded p-1.5 lg:p-1 transition-colors flex items-center justify-center cursor-pointer ${
              isLightColor(themeBackground) 
                ? 'text-slate-600 hover:text-purple-600 hover:bg-black/5' 
                : 'text-slate-400 hover:text-purple-400 hover:bg-white/5'
            }`}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 lg:w-3 lg:h-3" fill="currentColor">
              <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm6.5 1v8h1V4z" />
            </svg>
          </button>
          <button
            type="button"
            title="Split Vertical (Alt+E)"
            onClick={() => splitFocusedTerminal('vertical')}
            className={`w-7 h-7 lg:w-5 lg:h-5 rounded p-1.5 lg:p-1 transition-colors flex items-center justify-center cursor-pointer ${
              isLightColor(themeBackground) 
                ? 'text-slate-600 hover:text-purple-600 hover:bg-black/5' 
                : 'text-slate-400 hover:text-purple-400 hover:bg-white/5'
            }`}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 lg:w-3 lg:h-3" fill="currentColor">
              <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm1 5.5h12v-1H2z" />
            </svg>
          </button>
          {hasMultiplePanes && (
            <button
              type="button"
              title="Close Pane (Alt+W)"
              onClick={() => closePane(node.terminalId)}
              className={`w-7 h-7 lg:w-5 lg:h-5 rounded p-1.5 lg:p-1 transition-colors flex items-center justify-center cursor-pointer ${
                isLightColor(themeBackground) 
                  ? 'text-slate-600 hover:text-red-600 hover:bg-red-500/10' 
                  : 'text-slate-400 hover:text-red-400 hover:bg-white/5'
              }`}
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 lg:w-3 lg:h-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PanelGroup direction={node.direction}>
      <Panel defaultSize={50}>
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
        />
      </Panel>
      <PanelResizeHandle
        className={`transition-colors flex-shrink-0 ${
          isLightColor(themeBackground)
            ? 'bg-purple-500/10 hover:bg-purple-500/35'
            : 'bg-purple-500/15 hover:bg-purple-500/40'
        }`}
        style={{
          width: node.direction === 'horizontal' ? '4px' : '100%',
          height: node.direction === 'vertical' ? '4px' : '100%',
          cursor: node.direction === 'horizontal' ? 'col-resize' : 'row-resize',
        }}
      />
      <Panel defaultSize={50}>
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
        />
      </Panel>
    </PanelGroup>
  );
}
