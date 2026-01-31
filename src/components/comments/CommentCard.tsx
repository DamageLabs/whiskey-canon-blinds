import { useState } from 'react';
import type { Comment } from '@/services/api';

interface CommentCardProps {
  comment: Comment;
  onDelete?: (commentId: string) => void;
  onReply?: (parentId: string) => void;
  isReplying?: boolean;
}

export function CommentCard({ comment, onDelete, onReply, isReplying }: CommentCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleDelete = () => {
    if (showDeleteConfirm && onDelete) {
      onDelete(comment.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className={`p-3 bg-zinc-800/50 rounded-lg ${comment.parentId ? 'ml-6 border-l-2 border-zinc-700' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
            {comment.participantName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {comment.participantName}
              {comment.isOwn && (
                <span className="ml-2 text-xs text-amber-500">(you)</span>
              )}
            </p>
            <p className="text-xs text-zinc-500">{formatDate(comment.createdAt)}</p>
          </div>
        </div>
        {comment.isOwn && onDelete && (
          <button
            onClick={handleDelete}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showDeleteConfirm
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'text-zinc-500 hover:text-red-400'
            }`}
          >
            {showDeleteConfirm ? 'Confirm?' : 'Delete'}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{comment.content}</p>
      {!comment.parentId && onReply && (
        <button
          onClick={() => onReply(comment.id)}
          disabled={isReplying}
          className="mt-2 text-xs text-zinc-500 hover:text-amber-500 transition-colors disabled:opacity-50"
        >
          Reply
        </button>
      )}
    </div>
  );
}
