import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Cpu, Sparkles } from 'lucide-react';
import { ConsoleMessage, SuperAgentMessageItem, renderMessageContent } from './SuperAgentMessageItem';

interface SuperAgentGroupedMessagesProps {
  messages: ConsoleMessage[];
  isSystemNoiseMsg: (msg: ConsoleMessage) => boolean;
  isStreaming?: boolean;
}

export interface TurnBlock {
  type: 'assistant' | 'process';
  messages: ConsoleMessage[];
}

export interface MessageTurn {
  id: string;
  userMsg?: ConsoleMessage;
  blocks: TurnBlock[];
}

export function groupMessagesIntoTurns(
  messages: ConsoleMessage[],
  isSystemNoiseMsg: (msg: ConsoleMessage) => boolean
): MessageTurn[] {
  const filtered = messages.filter(m => !isSystemNoiseMsg(m));
  const turns: MessageTurn[] = [];

  let currentTurn: MessageTurn = {
    id: 'turn-0',
    blocks: []
  };

  filtered.forEach((msg, idx) => {
    if (msg.role === 'user') {
      if (currentTurn.userMsg || currentTurn.blocks.length > 0) {
        turns.push(currentTurn);
      }
      currentTurn = {
        id: `turn-${idx}`,
        userMsg: msg,
        blocks: []
      };
    } else if (msg.role === 'assistant') {
      const lastBlock = currentTurn.blocks[currentTurn.blocks.length - 1];
      if (lastBlock && lastBlock.type === 'assistant') {
        lastBlock.messages.push(msg);
      } else {
        currentTurn.blocks.push({
          type: 'assistant',
          messages: [msg]
        });
      }
    } else if (msg.role === 'thought' || msg.role === 'tool' || msg.role === 'system' || msg.role === 'connection') {
      const lastBlock = currentTurn.blocks[currentTurn.blocks.length - 1];
      if (lastBlock && lastBlock.type === 'process') {
        lastBlock.messages.push(msg);
      } else {
        currentTurn.blocks.push({
          type: 'process',
          messages: [msg]
        });
      }
    }
  });

  if (currentTurn.userMsg || currentTurn.blocks.length > 0) {
    turns.push(currentTurn);
  }

  return turns;
}

function CollapsibleProcessBlock({
  msgs,
  isLastTurn,
  isStreaming
}: {
  msgs: ConsoleMessage[];
  isLastTurn: boolean;
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState<boolean>(true);
  const userToggledRef = React.useRef<boolean>(false);
  const prevStreamingRef = React.useRef<boolean | undefined>(isStreaming);

  useEffect(() => {
    if (isLastTurn && isStreaming && !userToggledRef.current) {
      setExpanded(true);
    }
    prevStreamingRef.current = isStreaming;
  }, [msgs.length, isLastTurn, isStreaming]);

  if (msgs.length === 0) return null;

  const toolCount = msgs.filter(m => m.role === 'tool').length;
  const thoughtCount = msgs.filter(m => m.role === 'thought').length;

  const summaryLabel = [
    thoughtCount > 0 ? `${thoughtCount} thought${thoughtCount > 1 ? 's' : ''}` : '',
    toolCount > 0 ? `${toolCount} tool step${toolCount > 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(' • ') || `${msgs.length} process step${msgs.length > 1 ? 's' : ''}`;

  const handleToggle = () => {
    userToggledRef.current = true;
    setExpanded(prev => !prev);
  };

  return (
    <div className="my-1.5 font-mono text-xs w-full select-text">
      {/* Collapsible Header */}
      <div
        onClick={handleToggle}
        className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-[var(--surface-overlay-hover)] cursor-pointer transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)] select-none group"
      >
        <span className="shrink-0 text-[var(--color-primary)]">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-main)]" />
          )}
        </span>
        <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
        <span className="font-sans font-medium text-[11px] text-[var(--text-muted)]">
          Process steps ({summaryLabel})
        </span>
        {isLastTurn && isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-primary)] animate-pulse font-mono">
            <Cpu className="w-3 h-3 animate-spin" />
            <span>Running...</span>
          </span>
        )}
      </div>

      {/* Expandable Process Body */}
      {expanded && (
        <div className="mt-1 ml-3 pl-3 border-l-2 border-[var(--color-primary)]/30 space-y-1 my-1">
          {msgs.map((msg, idx) => (
            <SuperAgentMessageItem key={idx} msg={msg} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

export const SuperAgentGroupedMessages: React.FC<SuperAgentGroupedMessagesProps> = ({
  messages,
  isSystemNoiseMsg,
  isStreaming
}) => {
  const turns = groupMessagesIntoTurns(messages, isSystemNoiseMsg);

  return (
    <div className="space-y-6">
      {turns.map((turn, turnIdx) => {
        const isLastTurn = turnIdx === turns.length - 1;
        return (
          <div key={turn.id || turnIdx} className="relative space-y-2">
            {/* Sticky Floating User Prompt Header */}
            {turn.userMsg && (
              <div className="sticky -top-4 z-30 -mx-4 -mt-4 mb-3 px-4 py-2.5 bg-[var(--bg-card)]/95 backdrop-blur-md transition-all border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] uppercase font-bold font-mono text-[var(--color-primary)] shrink-0 select-none bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/60 px-1.5 py-0.2 rounded">
                    ❯ USER
                  </span>
                  <div className="text-xs text-[var(--text-main)] font-sans leading-relaxed flex-1 select-text">
                    {renderMessageContent(turn.userMsg.text)}
                  </div>
                </div>
              </div>
            )}

            {/* Turn blocks in exact chronological usage order */}
            {turn.blocks.map((block, blockIdx) => {
              if (block.type === 'process') {
                return (
                  <CollapsibleProcessBlock
                    key={`proc-${blockIdx}`}
                    msgs={block.messages}
                    isLastTurn={isLastTurn}
                    isStreaming={isStreaming && isLastTurn}
                  />
                );
              }

              return block.messages.map((astMsg, astIdx) => (
                <SuperAgentMessageItem
                  key={`ast-${blockIdx}-${astIdx}`}
                  msg={astMsg}
                  index={turnIdx * 100 + blockIdx * 10 + astIdx}
                />
              ));
            })}
          </div>
        );
      })}
    </div>
  );
};
