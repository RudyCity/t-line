import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  required?: boolean;
  align?: 'top' | 'bottom';
  variant?: 'default' | 'minimal';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  searchable = false,
  className = '',
  align = 'bottom',
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isKeyboardNavRef = useRef(false);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  // Find the selected option to display it
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Adjust active index when list opens or filters change
  useEffect(() => {
    if (isOpen) {
      // Focus search input if searchable
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
      
      // Default active index to the currently selected option or first non-disabled option
      const selectedIndex = filteredOptions.findIndex((opt) => opt.value === value);
      if (selectedIndex !== -1) {
        isKeyboardNavRef.current = true;
        setActiveIndex(selectedIndex);
      } else {
        const firstEnabled = filteredOptions.findIndex((opt) => !opt.disabled);
        setActiveIndex(firstEnabled);
      }
    } else {
      setActiveIndex(-1);
      setSearchQuery('');
    }
  }, [isOpen, filteredOptions, value, searchable]);

  // Scroll active option into view
  useEffect(() => {
    if (isKeyboardNavRef.current && activeIndex !== -1 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        // Adjust for search input container if searchable
        const elementToScroll = searchable 
          ? (listRef.current.children[activeIndex + 1] as HTMLElement)
          : activeEl;
        
        if (elementToScroll) {
          elementToScroll.scrollIntoView({
            block: 'nearest',
          });
        }
      }
    }
  }, [activeIndex, searchable]);

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleSelectOption = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[activeIndex]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        isKeyboardNavRef.current = true;
        // Find next non-disabled option
        let nextIndex = activeIndex;
        do {
          nextIndex = (nextIndex + 1) % filteredOptions.length;
          // Avoid infinite loop if all options are disabled
          if (nextIndex === activeIndex) break;
        } while (filteredOptions[nextIndex]?.disabled);
        setActiveIndex(nextIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        isKeyboardNavRef.current = true;
        // Find previous non-disabled option
        let prevIndex = activeIndex;
        do {
          prevIndex = (prevIndex - 1 + filteredOptions.length) % filteredOptions.length;
          if (prevIndex === activeIndex) break;
        } while (filteredOptions[prevIndex]?.disabled);
        setActiveIndex(prevIndex);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={variant === 'minimal'
          ? `flex items-center justify-between w-full text-[10px] font-semibold font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors duration-150 text-left outline-none cursor-pointer select-none py-0.5 pr-3 pl-0`
          : `flex items-center justify-between w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] transition-all duration-200 text-left outline-none cursor-pointer
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40 focus:border-[var(--color-primary)]/60 focus:ring-1 focus:ring-[var(--color-primary)]/25'}
              ${isOpen ? 'border-[var(--color-primary)]/60 ring-1 ring-[var(--color-primary)]/25' : ''}`
        }
        style={variant === 'minimal'
          ? { backgroundColor: 'transparent' }
          : { backgroundColor: 'var(--bg-main)' }
        }
      >
        <span className={`flex items-center gap-1.5 truncate ${!selectedOption ? 'text-[var(--text-muted)]' : ''}`}>
          {selectedOption?.icon && <span className="flex-shrink-0 text-sm">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          size={variant === 'minimal' ? 10 : 16}
          className={`text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 ml-1 ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 rounded-lg border border-[var(--border-color)] overflow-hidden shadow-2xl z-50 flex flex-col max-h-60 ${variant === 'minimal' ? 'min-w-[110px]' : 'right-0'} ${align === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
          style={{
            background: 'rgba(9, 12, 20, 0.95)',
            backdropFilter: 'blur(var(--blur-amount))',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-3 py-2 shrink-0">
              <Search size={14} className="text-[var(--text-muted)] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0); // Reset to first item on search
                }}
                placeholder="Search..."
                className="bg-transparent border-none w-full text-xs text-[var(--text-main)] outline-none placeholder-[var(--text-muted)]"
              />
            </div>
          )}

          <div
            ref={listRef}
            className="overflow-y-auto py-1 max-h-48"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--text-dark)] text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => {
                      if (!opt.disabled) {
                        isKeyboardNavRef.current = false;
                        setActiveIndex(index);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors duration-150 text-left outline-none
                      ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      ${isActive ? 'bg-[var(--color-primary)]/15 text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}
                      ${isSelected ? 'font-semibold text-[var(--text-main)]' : ''}
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] text-[var(--text-dark)] truncate mt-0.5 font-normal">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={14} className="text-[var(--color-primary)] shrink-0 ml-2 animate-fade-in" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
