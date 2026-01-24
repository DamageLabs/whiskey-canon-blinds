import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2 bg-zinc-800 border rounded-lg
            text-zinc-100 placeholder-zinc-500
            focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-none
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

Textarea.displayName = 'Textarea';
