import React from 'react';
import { SuperAgentToolItem } from './SuperAgentToolItem';
import { AdvisorResultCard, AdvisorResultCardProps } from './SuperAgentInteractiveCards';

export interface ConsoleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought' | 'connection';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
}

function tryParseAdvisorPayload(text: string): AdvisorResultCardProps | null {
  if (!text) return null;

  // Check if text starts or contains clear advisor markers
  const isAdvisorText = /\[?(Execution Advisor|Advisor Result|Advisor|Advice|Advisor Warning|Advisor Block)\]?/i.test(text);
  if (!isAdvisorText) return null;

  let verdict: 'PASS' | 'WARN' | 'BLOCK' | 'SUGGESTION' | 'INFO' = 'INFO';
  if (/PASS|APPROVED|SUCCESS/i.test(text)) verdict = 'PASS';
  else if (/WARN|CAUTION/i.test(text)) verdict = 'WARN';
  else if (/BLOCK|FAIL|ERROR|DENIED|HALT/i.test(text)) verdict = 'BLOCK';
  else if (/SUGGESTION|RECOMMEND/i.test(text)) verdict = 'SUGGESTION';

  // Extract confidence if present
  let confidence: number | undefined = undefined;
  const confMatch = text.match(/confidence:?\s*([\d.]+)/i);
  if (confMatch) {
    const parsed = parseFloat(confMatch[1]);
    if (!isNaN(parsed)) confidence = parsed;
  }

  // Parse suggestions
  const suggestions: string[] = [];
  const lines = text.split('\n');
  let summary = '';
  let reasoning = '';
  let inReasoning = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[•\-\*]\s+/.test(trimmed)) {
      suggestions.push(trimmed.replace(/^[•\-\*]\s+/, ''));
    } else if (/^reasoning:?/i.test(trimmed)) {
      inReasoning = true;
    } else if (inReasoning) {
      reasoning += line + '\n';
    } else if (!summary && trimmed && !/^\[?(Execution Advisor|Advisor Result|Advisor)\]?/i.test(trimmed)) {
      summary = trimmed;
    }
  }

  if (!summary) {
    summary = text.replace(/^\[?(Execution Advisor|Advisor Result|Advisor)\]?:?\s*/i, '').slice(0, 150);
  }

  return {
    title: 'Real-Time Execution Advisor',
    verdict,
    confidence,
    summary,
    suggestions,
    reasoning: reasoning.trim() || undefined,
    rawText: text,
  };
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
          className="font-mono bg-[var(--bg-card)] text-[var(--color-primary)] px-1 py-0.5 rounded text-[11px] border border-[var(--border-color)]"
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
        <strong key={keyIdx++} className="font-semibold text-[var(--text-main)]">
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
        <em key={keyIdx++} className="italic text-[var(--text-muted)]">
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
          className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline font-medium transition-colors"
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
        <div key={i} className="text-[10px] text-[var(--text-muted)] font-mono tracking-tight leading-normal my-0.5 opacity-80">
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
        <div key={`code-${i}`} className="my-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden font-mono text-xs ">
          <div className="flex items-center justify-between px-3 py-1 bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--color-primary)] uppercase tracking-wider">{lang || 'code'}</span>
            <button
              onClick={() => navigator.clipboard.writeText(codeText)}
              className="hover:text-[var(--text-main)] transition text-[10px] px-2 py-0.5 rounded bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] font-sans border border-[var(--border-color)]"
            >
              Copy
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-[var(--text-main)] text-[11px] leading-relaxed font-mono whitespace-pre custom-scrollbar">
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
          <div key={`table-${i}`} className="my-2.5 overflow-x-auto rounded-lg border border-[var(--border-color)] ">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] text-[var(--text-main)]">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 border-r border-[var(--border-color)] last:border-r-0 font-semibold text-[var(--color-primary)] text-[11px]">
                      {renderInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-sidebar)]">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[var(--surface-overlay-hover)] transition-colors even:bg-[var(--surface-overlay)]">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 border-r border-[var(--border-color)]/60 last:border-r-0 text-[var(--text-main)] text-[11px] leading-snug">
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
            <h1 key={`h1-${i}`} className="text-sm font-bold text-[var(--color-primary)] mt-3 mb-1.5 pb-1 border-b border-[var(--border-color)] tracking-wide">
              {renderInlineMarkdown(headingText)}
            </h1>
          );
        } else if (level === 2) {
          blocks.push(
            <h2 key={`h2-${i}`} className="text-xs font-bold text-[var(--color-primary)] mt-2.5 mb-1 pb-0.5 border-b border-[var(--border-color)]/60">
              {renderInlineMarkdown(headingText)}
            </h2>
          );
        } else if (level === 3) {
          blocks.push(
            <h3 key={`h3-${i}`} className="text-xs font-semibold text-[var(--text-main)] mt-2 mb-1">
              {renderInlineMarkdown(headingText)}
            </h3>
          );
        } else {
          blocks.push(
            <h4 key={`h4-${i}`} className="text-[11px] font-semibold text-[var(--text-muted)] mt-1.5 mb-0.5">
              {renderInlineMarkdown(headingText)}
            </h4>
          );
        }
        continue;
      }
    }

    // 5. Horizontal Rule: ---, ***, ___
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push(<hr key={`hr-${i}`} className="my-3 border-t border-[var(--border-color)]" />);
      i++;
      continue;
    }

    // 6. Blockquote: > quote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push(
        <blockquote key={`quote-${i}`} className="my-2 border-l-2 border-[var(--color-primary)] bg-[var(--color-primary-glow)] px-3 py-1.5 rounded-r text-[var(--text-main)] italic text-[11px]">
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
        <div key={`list-${i}`} className="flex items-start gap-2 my-0.5 pl-2 text-[var(--text-main)] text-xs">
          <span className="text-[var(--color-primary)] font-mono text-[11px] shrink-0 font-semibold">{prefix}</span>
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
        <div key={`p-${i}`} className="leading-relaxed text-[var(--text-main)] text-xs my-0.5">
          {renderInlineMarkdown(line)}
        </div>
      );
    }
    i++;
  }

  return <div className="space-y-0.5 font-sans select-text">{blocks}</div>;
}

export const SuperAgentMessageItem: React.FC<{ msg: ConsoleMessage; index: number }> = ({ msg, index }) => {
  // Check if message is an Execution Advisor result
  const advisorProps = tryParseAdvisorPayload(msg.text);
  if (advisorProps) {
    return <AdvisorResultCard key={index} {...advisorProps} />;
  }

  if (msg.role === 'connection') {
    const isError = /error|failed|unreachable|refused/i.test(msg.text);
    const isRestart = /restart|respawn|auto-start|starting/i.test(msg.text);
    const isReady = /ready|connected|up|available/i.test(msg.text);

    let dotClass = 'bg-sky-400 animate-pulse';
    let textClass = 'text-sky-400';
    let icon = '⟳';
    if (isError) { dotClass = 'bg-rose-500 animate-pulse'; textClass = 'text-rose-400'; icon = '✕'; }
    else if (isReady) { dotClass = 'bg-emerald-400'; textClass = 'text-emerald-400'; icon = '✓'; }
    else if (isRestart) { dotClass = 'bg-amber-400 animate-ping'; textClass = 'text-amber-400'; icon = '↺'; }

    return (
      <div key={index} className="flex items-center justify-start py-0.5 select-text">
        <div className={`text-[11px] font-mono tracking-tight flex items-center gap-2 select-text ${textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${dotClass}`}></span>
          <span className="opacity-60 text-[10px]">{icon}</span>
          <span className="break-all whitespace-pre-wrap select-text opacity-90">{msg.text}</span>
        </div>
      </div>
    );
  }

  if (msg.role === 'system') {
    const isError = /error|failed|econnrefused|exception|stopped|denied|cannot|invalid/i.test(msg.text);
    return (
      <div key={index} className="flex items-center justify-start py-1 select-text">
        <div className={`text-[11px] font-mono tracking-tight text-left flex items-center justify-start gap-2 select-text ${
          isError ? 'text-rose-400' : 'text-[var(--text-muted)]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
            isError ? 'bg-rose-500 animate-pulse' : 'bg-[var(--color-primary)]'
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
      <div key={index} className="my-2 py-2 px-3 bg-[var(--color-primary-glow)] text-xs font-sans text-[var(--text-main)] select-text rounded-lg border border-[var(--color-primary)]/40 ">
        <div className="flex items-center gap-1.5 mb-1 select-none text-[10px] font-bold font-mono text-[var(--color-primary)] uppercase">
          <span>❯ USER</span>
        </div>
        <div className="leading-relaxed">
          {renderMessageContent(msg.text)}
        </div>
      </div>
    );
  }

  return (
    <div key={index} className="py-2 px-1 w-full transition-all select-text bg-transparent border-none">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] uppercase tracking-wider font-bold font-mono ${
          msg.role === 'thought'
            ? 'text-[var(--color-primary)]'
            : 'text-emerald-500'
        }`}>
          {msg.role === 'thought' ? 'Thought' : 'Assistant'}
        </span>
      </div>

      <div className={`text-xs leading-relaxed ${
        msg.role === 'thought'
          ? 'text-[var(--text-muted)] italic font-mono pl-3 border-l-2 border-[var(--color-primary)]/50'
          : 'text-[var(--text-main)] font-sans'
      }`}>
        {renderMessageContent(msg.text)}
      </div>
    </div>
  );
};
