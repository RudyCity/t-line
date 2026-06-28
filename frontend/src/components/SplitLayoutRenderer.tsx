import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SplitLayoutNode, TerminalInstanceData } from '../hooks/useTerminals';
import { TerminalInstance } from './TerminalInstance';

export interface SplitLayoutRendererProps {
  node: SplitLayoutNode;
  activeTabId: string;
  focusedTerminalId?: string;
  wsConnected: boolean;
  terminalFontSize: number;
  terminalInstances: Record<string, TerminalInstanceData>;
  handleTitleChange: (id: string, title: string) => void;
  focusTerminal: (id: string) => void;
  closePane: (id: string) => void;
  splitFocusedTerminal: (direction: 'horizontal' | 'vertical') => void;
  hasMultiplePanes: boolean;
  onTerminalFocus?: () => void;
}

export function SplitLayoutRenderer({
  node,
  activeTabId,
  focusedTerminalId,
  wsConnected,
  terminalFontSize,
  terminalInstances,
  handleTitleChange,
  focusTerminal,
  closePane,
  splitFocusedTerminal,
  hasMultiplePanes,
  onTerminalFocus
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
          border: isFocused ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
          background: isFocused ? 'rgba(168, 85, 247, 0.02)' : 'transparent',
          boxSizing: 'border-box'
        }}
        className="group/pane"
      >
        <TerminalInstance
          tab={term as any}
          active={!!(activeTabId && isFocused)}
          wsConnected={wsConnected}
          fontSize={terminalFontSize}
          onTitleChange={(title) => handleTitleChange(term.id, title)}
          onFocus={() => {
            focusTerminal(node.terminalId);
            onTerminalFocus?.();
          }}
        />
        
        {/* Floating action bar at top-right of each pane */}
        <div 
          className="absolute bottom-2 right-2 top-auto lg:top-2 lg:right-2 lg:bottom-auto flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover/pane:opacity-100 transition-opacity duration-200 z-50 bg-[#0f111a]/85 backdrop-blur-md border border-purple-500/25 rounded-md p-1.5 lg:p-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Split Horizontal (Alt+D)"
            onClick={() => splitFocusedTerminal('horizontal')}
            className="w-7 h-7 lg:w-5 lg:h-5 text-slate-400 hover:text-purple-400 hover:bg-white/5 rounded p-1.5 lg:p-1 transition-colors flex items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 lg:w-3 lg:h-3" fill="currentColor">
              <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm6.5 1v8h1V4z" />
            </svg>
          </button>
          <button
            type="button"
            title="Split Vertical (Alt+E)"
            onClick={() => splitFocusedTerminal('vertical')}
            className="w-7 h-7 lg:w-5 lg:h-5 text-slate-400 hover:text-purple-400 hover:bg-white/5 rounded p-1.5 lg:p-1 transition-colors flex items-center justify-center cursor-pointer"
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
              className="w-7 h-7 lg:w-5 lg:h-5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded p-1.5 lg:p-1 transition-colors flex items-center justify-center cursor-pointer"
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
          focusTerminal={focusTerminal}
          closePane={closePane}
          splitFocusedTerminal={splitFocusedTerminal}
          hasMultiplePanes={hasMultiplePanes}
          onTerminalFocus={onTerminalFocus}
        />
      </Panel>
      <PanelResizeHandle
        className="bg-purple-500/15 hover:bg-purple-500/40 transition-colors flex-shrink-0"
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
          focusTerminal={focusTerminal}
          closePane={closePane}
          splitFocusedTerminal={splitFocusedTerminal}
          hasMultiplePanes={hasMultiplePanes}
          onTerminalFocus={onTerminalFocus}
        />
      </Panel>
    </PanelGroup>
  );
}
