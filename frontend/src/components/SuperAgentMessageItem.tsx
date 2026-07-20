import React from 'react';
import { SuperAgentToolItem } from './SuperAgentToolItem';

export interface ConsoleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
}

export function renderMessageContent(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => {
        if (line.trim().startsWith('[SYS]')) {
          return (
            <div key={i} className="text-[10px] text-zinc-500 font-mono tracking-tight leading-normal">
              {line}
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap">
            {line}
          </div>
        );
      })}
    </div>
  );
}

export const SuperAgentMessageItem: React.FC<{ msg: ConsoleMessage; index: number }> = ({ msg, index }) => {
  if (msg.role === 'system') {
    const isError = /error|failed|econnrefused|exception|stopped|denied|cannot|invalid/i.test(msg.text);
    return (
      <div key={index} className="flex items-center justify-start py-1 select-text">
        <div className={`text-[11px] font-mono tracking-tight text-left flex items-center justify-start gap-2 select-text ${
          isError ? 'text-rose-400' : 'text-zinc-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
            isError ? 'bg-rose-500 animate-pulse' : 'bg-indigo-400'
          }`}></span>
          <span className="break-all whitespace-pre-wrap select-text">{msg.text}</span>
        </div>
      </div>
    );
  }

  if (msg.role === 'tool') {
    return <SuperAgentToolItem key={index} msg={msg} />;
  }

  return (
    <div key={index} className="py-2 px-1 w-full transition-all select-text bg-transparent border-none">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] uppercase tracking-wider font-bold font-mono ${
          msg.role === 'user'
            ? 'text-indigo-400'
            : msg.role === 'thought'
            ? 'text-purple-400'
            : 'text-emerald-400'
        }`}>
          {msg.role === 'user' ? 'User' : msg.role === 'thought' ? 'Thought' : 'Assistant'}
        </span>
      </div>

      <div className={`text-xs leading-relaxed ${
        msg.role === 'user'
          ? 'text-zinc-100 font-sans'
          : msg.role === 'thought'
          ? 'text-zinc-400 italic font-mono pl-3 border-l-2 border-indigo-500/50'
          : 'text-zinc-200 font-sans'
      }`}>
        {renderMessageContent(msg.text)}
      </div>
    </div>
  );
};
