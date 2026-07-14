import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { wsManager } from '../services/websocket';
import { isPromptReady } from '../components/TerminalHelpers';

interface UseTerminalInitialCommandProps {
  wsConnected: boolean;
  isInitialized: boolean;
  initialCommand?: string;
  tabId: string;
  onClearInitialCommand?: (tabId: string) => void;
  terminalRef: React.RefObject<Terminal | null>;
  onPtyDataRef: React.MutableRefObject<(() => void) | null>;
}

export function useTerminalInitialCommand({
  wsConnected,
  isInitialized,
  initialCommand,
  tabId,
  onClearInitialCommand,
  terminalRef,
  onPtyDataRef
}: UseTerminalInitialCommandProps) {
  const FALLBACK_MS = 6000;
  const initialCommandSent = useRef(false);

  useEffect(() => {
    if (!wsConnected || !isInitialized || !initialCommand || initialCommandSent.current) return;

    let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
    let checkTimeout: ReturnType<typeof setTimeout> | null = null;

    const sendCommand = () => {
      if (initialCommandSent.current) return;
      initialCommandSent.current = true;
      onPtyDataRef.current = null;
      if (scheduledTimer) clearTimeout(scheduledTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimeout) clearTimeout(checkTimeout);

      const cmdStr = initialCommand.endsWith('\r') || initialCommand.endsWith('\n')
        ? initialCommand
        : initialCommand + '\r';

      wsManager.send(JSON.stringify({
        type: 'data',
        id: tabId,
        data: cmdStr
      }));
      onClearInitialCommand?.(tabId);
    };

    // Fallback: fire unconditionally after FALLBACK_MS
    const fallbackTimer = setTimeout(sendCommand, FALLBACK_MS);

    // Initial check timer
    scheduledTimer = setTimeout(sendCommand, 1500);

    onPtyDataRef.current = () => {
      if (initialCommandSent.current) return;

      if (checkTimeout) clearTimeout(checkTimeout);
      checkTimeout = setTimeout(() => {
        checkTimeout = null;
        if (initialCommandSent.current) return;

        const term = terminalRef.current;
        const promptReady = term ? isPromptReady(term) : false;

        if (promptReady) {
          // Prompt is ready! Schedule sendCommand with 150ms delay
          if (scheduledTimer) clearTimeout(scheduledTimer);
          scheduledTimer = setTimeout(sendCommand, 150);
        } else {
          // Prompt not ready yet; reschedule fallback silence timer for 1200ms
          if (scheduledTimer) clearTimeout(scheduledTimer);
          scheduledTimer = setTimeout(sendCommand, 1200);
        }
      }, 50);
    };

    return () => {
      onPtyDataRef.current = null;
      if (scheduledTimer) clearTimeout(scheduledTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, [wsConnected, isInitialized, initialCommand, tabId, onClearInitialCommand, terminalRef, onPtyDataRef]);
}
