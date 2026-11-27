import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectOption = { value: string; label: string; hint?: string };

/** Accessible popover select. Native <select> is banned by the project design
 * system because its OS popup breaks theming; this keeps full keyboard support
 * and crisp token-bound styling. */
export default function SelectMenu({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select',
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : 0);
  }, [open, options, value]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-7 max-w-56 items-center gap-1 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-card)] px-2 text-[11px] text-[var(--text-main)] transition-colors hover:border-[var(--color-primary)] disabled:opacity-40"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={12} aria-hidden className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <ul
          role="listbox"
          id={listId}
          aria-label={label}
          className="absolute left-0 top-8 z-30 max-h-64 w-64 overflow-auto rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(options.length - 1, index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const option = options[activeIndex];
              if (option) choose(option.value);
            }
          }}
        >
          {options.length === 0 && (
            <li className="px-2 py-1.5 text-[11px] text-[var(--text-muted)]">No options available</li>
          )}
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                ref={(element) => {
                  if (index === activeIndex) element?.focus();
                }}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-[4px] px-2 py-1.5 text-left text-[11px] transition-colors ${
                  option.value === value
                    ? 'bg-[var(--bg-main)] text-[var(--text-main)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {option.hint && <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">{option.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
