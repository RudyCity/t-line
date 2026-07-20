import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Cpu, Sparkles } from 'lucide-react';
import { ConsoleMessage, SuperAgentMessageItem } from './SuperAgentMessageItem';

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
    } else if (msg.role === 'thought' || msg.role === 'tool' || msg.role === 'system') {
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
  // Default to expanded while streaming on the last turn
  const [expanded, setExpanded] = useState<boolean>(Boolean(isLastTurn && isStreaming));
  const userToggledRef = React.useRef<boolean>(false);
  const prevStreamingRef = React.useRef<boolean | undefined>(isStreaming);

  // Manage expansion state: only auto-toggle on active streaming transitions
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    const nowStreaming = Boolean(isStreaming);

    // 1. Streaming just started on the active last turn -> auto expand
    if (isLastTurn && !wasStreaming && nowStreaming) {
      setExpanded(true);
      userToggledRef.current = false;
    }
    // 2. Streaming just finished on the active last turn -> auto contract/collapse
    else if (isLastTurn && wasStreaming && !nowStreaming) {
      setExpanded(false);
      userToggledRef.current = false;
    }
    // 3. While actively streaming on last turn -> keep expanded unless user manually collapsed it
    else if (isLastTurn && nowStreaming && !userToggledRef.current) {
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
        className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-zinc-800/40 cursor-pointer transition-colors text-zinc-400 hover:text-zinc-200 select-none group"
      >
        <span className="shrink-0 text-indigo-400">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
          )}
        </span>
        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="font-sans font-medium text-[11px] text-zinc-400">
          Process steps ({summaryLabel})
        </span>
        {isLastTurn && isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-indigo-400 animate-pulse font-mono">
            <Cpu className="w-3 h-3 animate-spin" />
            <span>Running...</span>
          </span>
        )}
      </div>

      {/* Expandable Process Body */}
      {expanded && (
        <div className="mt-1 ml-3 pl-3 border-l-2 border-indigo-500/30 space-y-1 my-1">
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
    <>
      {turns.map((turn, turnIdx) => {
        const isLastTurn = turnIdx === turns.length - 1;
        return (
          <React.Fragment key={turn.id || turnIdx}>
            {/* User message */}
            {turn.userMsg && <SuperAgentMessageItem msg={turn.userMsg} index={turnIdx * 100} />}

            {/* Turn blocks in chronological order */}
            {turn.blocks.map((block, blockIdx) => {
              const isLastBlock = isLastTurn && blockIdx === turn.blocks.length - 1;
              if (block.type === 'process') {
                return (
                  <CollapsibleProcessBlock
                    key={`proc-${blockIdx}`}
                    msgs={block.messages}
                    isLastTurn={isLastTurn}
                    isStreaming={isStreaming && isLastBlock}
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
          </React.Fragment>
        );
      })}
    </>
  );
};
