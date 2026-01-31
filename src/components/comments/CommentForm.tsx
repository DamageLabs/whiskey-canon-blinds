import { useState } from 'react';
import { Button } from '@/components/ui';

interface CommentFormProps {
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  isReply?: boolean;
}

export function CommentForm({
  onSubmit,
  onCancel,
  isLoading = false,
  placeholder = 'Share your thoughts on this whiskey...',
  isReply = false,
}: CommentFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className={`${isReply ? 'ml-6' : ''}`}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        rows={isReply ? 2 : 3}
        maxLength={1000}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm placeholder-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none disabled:opacity-50"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-zinc-500">
          {content.length}/1000
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!content.trim() || isLoading}
            isLoading={isLoading}
          >
            {isReply ? 'Reply' : 'Post Comment'}
          </Button>
        </div>
      </div>
    </form>
  );
}
