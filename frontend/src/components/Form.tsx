import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  return (
    <input
      className={`form-input w-full bg-black/15 border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/25 transition-all duration-200 ${className}`}
      {...props}
    />
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  options: { value: string; label: string; disabled?: boolean }[];
}

export const Select: React.FC<SelectProps> = ({ className = '', options, ...props }) => {
  return (
    <select
      className={`form-input w-full bg-black/15 border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/25 transition-all duration-200 cursor-pointer ${className}`}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-[var(--bg-sidebar)] text-[var(--text-main)]">
          {opt.label}
        </option>
      ))}
    </select>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ className = '', ...props }) => {
  return (
    <textarea
      className={`form-input w-full bg-black/15 border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/25 transition-all duration-200 ${className}`}
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
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  let baseClass = 'btn transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2';
  let variantClass = '';

  if (variant === 'primary') {
    variantClass = 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-lg shadow-[var(--color-primary-glow)]';
  } else if (variant === 'secondary') {
    variantClass = 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-color)]';
  } else if (variant === 'danger') {
    variantClass = 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10 hover:shadow-red-500/30';
  }

  return (
    <button
      className={`${baseClass} ${variantClass} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </button>
  );
};
