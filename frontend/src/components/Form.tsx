import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', style, ...props }) => {
  return (
    <input
      className={`form-input w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/25 transition-all duration-200 ${className}`}
      style={{ backgroundColor: 'var(--bg-main)', ...style }}
      {...props}
    />
  );
};

import { CustomSelect, CustomSelectProps, SelectOption } from './CustomSelect';

export type SelectProps = CustomSelectProps;
export const Select = CustomSelect;
export type { SelectOption };

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ className = '', style, ...props }) => {
  return (
    <textarea
      className={`form-input w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/25 transition-all duration-200 ${className}`}
      style={{ backgroundColor: 'var(--bg-main)', ...style }}
      {...props}
    />
  );
};

interface FormFieldProps {
  label: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, children, className = '' }) => {
  return (
    <div className={`flex flex-col gap-1.5 mb-4 ${className}`}>
      <label className="text-xs font-semibold text-[var(--text-muted)] tracking-wide uppercase">{label}</label>
      {children}
      {error && <span className="text-xs text-red-400 font-medium mt-0.5">{error}</span>}
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClass = 'btn';
  const sizeClass = `btn-${size}`;
  const variantClass = `btn-${variant}`;

  return (
    <button
      className={`${baseClass} ${sizeClass} ${variantClass} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
};
