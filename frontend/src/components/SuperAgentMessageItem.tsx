import React from 'react';
import { SuperAgentToolItem } from './SuperAgentToolItem';

export interface ConsoleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={keyIdx++}
          className="font-mono bg-zinc-800/80 text-indigo-300 px-1 py-0.5 rounded text-[11px] border border-zinc-700/50"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold text: **bold** or __bold__
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={keyIdx++} className="font-semibold text-zinc-100">
          {renderInlineMarkdown(boldMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Italic text: *italic* or _italic_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch) {
      tokens.push(
        <em key={keyIdx++} className="italic text-zinc-300">
          {renderInlineMarkdown(italicMatch[2])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 4. Link: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push(
        <a
          key={keyIdx++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline font-medium transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Next plain character/word up to next special char (` * _ [)
    const nextSpecial = remaining.search(/[`*_[]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens.length === 1 ? tokens[0] : <React.Fragment>{tokens}</React.Fragment>;
}

export function renderMessageContent(text: string) {
  if (!text) return null;

  const rawLines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. [SYS] System Noise Line
    if (trimmed.startsWith('[SYS]')) {
      blocks.push(
        <div key={i} className="text-[10px] text-zinc-500 font-mono tracking-tight leading-normal my-0.5">
          {line}
        </div>
      );
      i++;
      continue;
    }

    // 2. Fenced Code Block: ```lang ... ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++;
      const codeText = codeLines.join('\n');
      blocks.push(
        <div key={`code-${i}`} className="my-2 rounded-lg border border-zinc-800 bg-[#0d111a] overflow-hidden font-mono text-xs shadow-sm">
          <div className="flex items-center justify-between px-3 py-1 bg-[#141824] border-b border-zinc-800/80 text-[10px] text-zinc-400">
            <span className="font-semibold text-indigo-300 uppercase tracking-wider">{lang || 'code'}</span>
            <button
              onClick={() => navigator.clipboard.writeText(codeText)}
              className="hover:text-zinc-200 transition text-[10px] px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700 font-sans"
            >
              Copy
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-zinc-200 text-[11px] leading-relaxed font-mono whitespace-pre custom-scrollbar">
            {codeText}
          </pre>
        </div>
      );
      continue;
    }

    // 3. Markdown Table: line starts and ends with | or contains |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        tableLines.push(rawLines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (r: string) => r.slice(1, -1).split('|').map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const dataRows = tableLines.slice(2).map(parseRow);

        blocks.push(
          <div key={`table-${i}`} className="my-2.5 overflow-x-auto rounded-lg border border-zinc-800/90 shadow-sm">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-[#121623] border-b border-zinc-800 text-zinc-300">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 border-r border-zinc-800/60 last:border-r-0 font-semibold text-indigo-300 text-[11px]">
                      {renderInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-[#0b0e17]">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-800/40 transition-colors even:bg-zinc-900/30">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 border-r border-zinc-800/40 last:border-r-0 text-zinc-300 text-[11px] leading-snug">
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 4. Headings: #, ##, ###, ####
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,4})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const headingText = match[2];
        i++;
        if (level === 1) {
          blocks.push(
            <h1 key={`h1-${i}`} className="text-sm font-bold text-indigo-300 mt-3 mb-1.5 pb-1 border-b border-zinc-800/80 tracking-wide">
              {renderInlineMarkdown(headingText)}
            </h1>
          );
        } else if (level === 2) {
          blocks.push(
            <h2 key={`h2-${i}`} className="text-xs font-bold text-indigo-200 mt-2.5 mb-1 pb-0.5 border-b border-zinc-800/50">
              {renderInlineMarkdown(headingText)}
            </h2>
          );
        } else if (level === 3) {
          blocks.push(
            <h3 key={`h3-${i}`} className="text-xs font-semibold text-zinc-200 mt-2 mb-1">
              {renderInlineMarkdown(headingText)}
            </h3>
          );
        } else {
          blocks.push(
            <h4 key={`h4-${i}`} className="text-[11px] font-semibold text-zinc-300 mt-1.5 mb-0.5">
              {renderInlineMarkdown(headingText)}
            </h4>
          );
        }
        continue;
      }
    }

    // 5. Horizontal Rule: ---, ***, ___
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push(<hr key={`hr-${i}`} className="my-3 border-t border-zinc-800/80" />);
      i++;
      continue;
    }

    // 6. Blockquote: > quote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push(
        <blockquote key={`quote-${i}`} className="my-2 border-l-2 border-indigo-500/80 bg-indigo-950/20 px-3 py-1.5 rounded-r text-zinc-300 italic text-[11px]">
          {renderInlineMarkdown(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 7. Unordered / Ordered List Item: - item, * item, 1. item
    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)/);
    if (listMatch) {
      const prefix = listMatch[1];
      const itemText = listMatch[2];
      blocks.push(
        <div key={`list-${i}`} className="flex items-start gap-2 my-0.5 pl-2 text-zinc-200 text-xs">
          <span className="text-indigo-400 font-mono text-[11px] shrink-0 font-semibold">{prefix}</span>
          <span className="flex-1 leading-normal">{renderInlineMarkdown(itemText)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 8. Normal Paragraph Line
    if (trimmed === '') {
      blocks.push(<div key={`empty-${i}`} className="h-1.5" />);
    } else {
      blocks.push(
        <div key={`p-${i}`} className="leading-relaxed text-zinc-200 text-xs my-0.5">
          {renderInlineMarkdown(line)}
        </div>
      );
    }
    i++;
  }

  return <div className="space-y-0.5 font-sans select-text">{blocks}</div>;
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

  if (msg.role === 'user') {
    return (
      <div key={index} className="my-3 pt-3 border-t border-zinc-800/80 w-full select-text">
        <div className="bg-[#10111a] border border-indigo-500/30 rounded-lg p-3 shadow-md transition-all">
          <div className="flex items-center gap-2 mb-1.5 select-none">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold font-mono text-indigo-300 bg-indigo-950/70 border border-indigo-800/50 px-2 py-0.5 rounded">
              <span>❯ USER</span>
            </span>
          </div>
          <div className="text-xs text-zinc-100 font-sans leading-relaxed">
            {renderMessageContent(msg.text)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={index} className="py-2 px-1 w-full transition-all select-text bg-transparent border-none">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] uppercase tracking-wider font-bold font-mono ${
          msg.role === 'thought'
            ? 'text-purple-400'
            : 'text-emerald-400'
        }`}>
          {msg.role === 'thought' ? 'Thought' : 'Assistant'}
        </span>
      </div>

      <div className={`text-xs leading-relaxed ${
        msg.role === 'thought'
          ? 'text-zinc-400 italic font-mono pl-3 border-l-2 border-indigo-500/50'
          : 'text-zinc-200 font-sans'
      }`}>
        {renderMessageContent(msg.text)}
      </div>
    </div>
  );
};
