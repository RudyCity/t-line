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
    console.log(`[useTerminalInitialCommand] Hook triggered for tab ${tabId}. States: wsConnected=${wsConnected}, isInitialized=${isInitialized}, initialCommand="${initialCommand || ''}", initialCommandSent=${initialCommandSent.current}`);

    if (!wsConnected || !isInitialized || !initialCommand || initialCommandSent.current) {
      console.log(`[useTerminalInitialCommand] Skipping command execution for tab ${tabId} because conditions are not met.`);
      return;
    }

    let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
    let checkTimeout: ReturnType<typeof setTimeout> | null = null;

    const sendCommand = () => {
      if (initialCommandSent.current) {
        console.log(`[useTerminalInitialCommand] sendCommand aborting for tab ${tabId}: already sent.`);
        return;
      }
      initialCommandSent.current = true;
      onPtyDataRef.current = null;
      if (scheduledTimer) clearTimeout(scheduledTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimeout) clearTimeout(checkTimeout);

      const cmdStr = initialCommand.endsWith('\r') || initialCommand.endsWith('\n')
        ? initialCommand
        : initialCommand + '\r';

      console.log(`[useTerminalInitialCommand] Executing sendCommand for tab ${tabId}. Sending command length: ${cmdStr.length}, command: "${cmdStr.trim()}"`);
      wsManager.send(JSON.stringify({
        type: 'data',
        id: tabId,
        data: cmdStr
      }));
      onClearInitialCommand?.(tabId);
    };

    // Fallback: fire unconditionally after FALLBACK_MS
    console.log(`[useTerminalInitialCommand] Setting fallback timer for ${FALLBACK_MS}ms for tab ${tabId}`);
    const fallbackTimer = setTimeout(() => {
      console.log(`[useTerminalInitialCommand] Fallback timer fired for tab ${tabId}`);
      sendCommand();
    }, FALLBACK_MS);

    // Initial check timer (fires after 1.5s as a safety)
    console.log(`[useTerminalInitialCommand] Setting safety check timer for 1500ms for tab ${tabId}`);
    scheduledTimer = setTimeout(() => {
      console.log(`[useTerminalInitialCommand] Safety check timer fired for tab ${tabId}`);
      sendCommand();
    }, 1500);

    onPtyDataRef.current = () => {
      if (initialCommandSent.current) return;

      if (checkTimeout) clearTimeout(checkTimeout);
      checkTimeout = setTimeout(() => {
        checkTimeout = null;
        if (initialCommandSent.current) return;

        const term = terminalRef.current;
        const promptReady = term ? isPromptReady(term) : false;
        console.log(`[useTerminalInitialCommand] PTY data received. Checking prompt readiness for tab ${tabId}: promptReady=${promptReady}`);

        if (promptReady) {
          console.log(`[useTerminalInitialCommand] Prompt is ready for tab ${tabId}! Scheduling execution in 150ms.`);
          if (scheduledTimer) clearTimeout(scheduledTimer);
          scheduledTimer = setTimeout(() => {
            console.log(`[useTerminalInitialCommand] Executing scheduled sendCommand after prompt detection for tab ${tabId}`);
            sendCommand();
          }, 150);
        } else {
          console.log(`[useTerminalInitialCommand] Prompt is NOT ready for tab ${tabId}. Rescheduling silence timer for 1200ms.`);
          if (scheduledTimer) clearTimeout(scheduledTimer);
          scheduledTimer = setTimeout(() => {
            console.log(`[useTerminalInitialCommand] Silence timer fired for tab ${tabId}`);
            sendCommand();
          }, 1200);
        }
      }, 50);
    };

    return () => {
      console.log(`[useTerminalInitialCommand] Cleanup hook called for tab ${tabId}`);
      onPtyDataRef.current = null;
      if (scheduledTimer) clearTimeout(scheduledTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, [wsConnected, isInitialized, initialCommand, tabId, onClearInitialCommand, terminalRef, onPtyDataRef]);
}

