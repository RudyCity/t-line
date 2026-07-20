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
    return (
      <div key={index} className="flex items-center justify-start my-1 select-none">
        <div className="text-[10px] text-zinc-400/90 font-mono bg-[#0c0f18] border border-zinc-800/80 px-3 py-0.5 rounded-full tracking-tight max-w-2xl text-left shadow-xs flex items-center justify-start gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/70 inline-block shrink-0"></span>
          <span className="truncate">{msg.text}</span>
        </div>
      </div>
    );
  }

  if (msg.role === 'tool') {
    return <SuperAgentToolItem key={index} msg={msg} />;
  }

  return (
    <div
      key={index}
      className={`p-3.5 rounded-xl border w-full transition-all shadow-sm ${
        msg.role === 'user'
          ? 'bg-indigo-950/30 border-indigo-800/40 text-indigo-100'
          : msg.role === 'thought'
          ? 'bg-slate-950/50 border-slate-800/50 text-slate-400 text-xs italic border-l-4 border-l-indigo-500 pl-4'
          : 'bg-[#0d101a] border-zinc-800/80 text-zinc-200'
      }`}
    >
      <span className={`block text-[10px] uppercase tracking-wider mb-1.5 font-bold font-mono ${
        msg.role === 'thought' ? 'text-indigo-400' : 'text-zinc-500'
      }`}>
        {msg.role}
      </span>
      {renderMessageContent(msg.text)}
    </div>
  );
};
