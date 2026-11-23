import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface StudioMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
  onClick: () => void;
}

export interface StudioContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: StudioMenuItem[];
  onClose: () => void;
}

export function StudioContextMenu({
  x,
  y,
  title,
  items,
  onClose,
}: StudioContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x, y });
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Filter clickable items for keyboard navigation
  const clickableItems = items.filter(it => !it.disabled);

  // Viewport edge collision handling
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let nextX = x;
    let nextY = y;

    if (x + rect.width > window.innerWidth - padding) {
      nextX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (y + rect.height > window.innerHeight - padding) {
      nextY = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setPosition({ x: nextX, y: nextY });
  }, [x, y]);

  // Click outside and keydown listeners
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev + 1;
          return next >= clickableItems.length ? 0 : next;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev - 1;
          return next < 0 ? clickableItems.length - 1 : next;
        });
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < clickableItems.length) {
          const item = clickableItems[activeIndex];
          item.onClick();
          onClose();
        }
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, activeIndex, clickableItems]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={title || 'Studio context menu'}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
      }}
      className="min-w-[210px] select-none rounded-lg border border-[#2a2d3d] bg-[#12141f]/95 p-1 text-xs text-zinc-200 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
    >
      {title && (
        <div className="flex items-center justify-between border-b border-[#222533] px-2.5 py-1.5 mb-1 text-[10px] font-mono font-medium uppercase tracking-wider text-zinc-400">
          <span>{title}</span>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {items.map((item, idx) => {
          const isItemActive =
            activeIndex >= 0 && clickableItems[activeIndex]?.id === item.id;

          return (
            <React.Fragment key={item.id + '-' + idx}>
              {item.dividerBefore && (
                <div className="my-1 h-px bg-[#222533]/80" role="separator" />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className={`group flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed pointer-events-none text-zinc-500'
                    : item.danger
                    ? isItemActive
                      ? 'bg-rose-950/80 text-rose-200'
                      : 'text-rose-400 hover:bg-rose-950/60 hover:text-rose-200'
                    : isItemActive
                    ? 'bg-cyan-950/80 text-cyan-200'
                    : 'text-zinc-200 hover:bg-[#1a1e2d] hover:text-cyan-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {item.icon && (
                    <span
                      className={`shrink-0 ${
                        item.danger
                          ? 'text-rose-400'
                          : 'text-zinc-400 group-hover:text-cyan-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </div>

                {item.shortcut && (
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400">
                    {item.shortcut}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
