import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 bg-zinc-800 border rounded-lg
            text-zinc-100 placeholder-zinc-500
            focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-zinc-700'}
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1 text-sm text-zinc-500">{hint}</p>
        )}
        {error && (
          <p className="mt-1 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
