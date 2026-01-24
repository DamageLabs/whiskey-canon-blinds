import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, variant = 'default', className = '', ...props }: CardProps) {
  const variants = {
    default: 'bg-zinc-800/50',
    elevated: 'bg-zinc-800 shadow-xl',
    outlined: 'bg-transparent border border-zinc-700',
  };

  return (
    <div
      className={`rounded-xl p-6 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        {description && (
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-zinc-700 ${className}`}>
      {children}
    </div>
  );
}
