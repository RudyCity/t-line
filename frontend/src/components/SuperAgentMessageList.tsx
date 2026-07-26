import React from 'react';
import { ArrowDown, Terminal } from 'lucide-react';
import { SuperAgentMessageItem } from './SuperAgentMessageItem';

interface SuperAgentMessageListProps {
  messages: any[];
  streamingContent: string;
  isStreaming: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  showScrollBottom: boolean;
  scrollToBottom: () => void;
}

export const SuperAgentMessageList: React.FC<SuperAgentMessageListProps> = ({
  messages,
  streamingContent,
  isStreaming,
  messagesEndRef,
  showScrollBottom,
  scrollToBottom
}) => {
  return (
    <div className="relative flex-1 overflow-y-auto p-4 space-y-4 font-sans custom-scrollbar">
      {messages.length === 0 && !isStreaming ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
          <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20">
            <Terminal className="w-8 h-8 text-purple-400" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-300">SuperAgent R-Engine Terminal</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              Mendukung eksekusi autonomous multi-agent, penanganan izin interaktif, MCP, dan RMemory context.
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg, index) => (
            <SuperAgentMessageItem
              key={msg.id || index}
              msg={msg}
              index={index}
            />
          ))}

          {isStreaming && (
            <div className="flex gap-3 bg-purple-950/20 border border-purple-500/20 p-3.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping mt-1.5 shrink-0" />
              <div className="space-y-1 text-xs text-purple-200">
                <span className="font-semibold text-purple-400">SuperAgent sedang memproses...</span>
                <p className="whitespace-pre-wrap font-mono text-gray-300 leading-relaxed">{streamingContent}</p>
              </div>
            </div>
          )}
        </>
      )}

      <div ref={messagesEndRef} />

      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-full transition-all cursor-pointer z-10"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
