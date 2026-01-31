import { useState, useEffect } from 'react';
import { CommentCard } from './CommentCard';
import { CommentForm } from './CommentForm';
import { commentsApi, type Comment } from '@/services/api';
import { onSocketEvent } from '@/services/socket';

interface CommentListProps {
  sessionId: string;
  whiskeyId: string;
  whiskeyName?: string;
}

export function CommentList({ sessionId, whiskeyId, whiskeyName }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setIsLoading(true);
        const data = await commentsApi.getForWhiskey(sessionId, whiskeyId);
        setComments(data);
        setError(null);
      } catch (err) {
        setError('Failed to load comments');
        console.error('Failed to fetch comments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();

    // Socket listeners for real-time updates
    const unsubAdd = onSocketEvent('comment:add', (newComment: Comment) => {
      if (newComment.whiskeyId === whiskeyId) {
        setComments((prev) => {
          // Avoid duplicates
          if (prev.some((c) => c.id === newComment.id)) return prev;
          return [newComment, ...prev];
        });
      }
    });

    const unsubDelete = onSocketEvent('comment:delete', (data: { id: string; whiskeyId: string }) => {
      if (data.whiskeyId === whiskeyId) {
        setComments((prev) => prev.filter((c) => c.id !== data.id));
      }
    });

    return () => {
      unsubAdd();
      unsubDelete();
    };
  }, [sessionId, whiskeyId]);

  const handleSubmit = async (content: string, parentId?: string) => {
    try {
      setIsSubmitting(true);
      const newComment = await commentsApi.create({
        sessionId,
        whiskeyId,
        content,
        parentId,
      });
      // Add locally (socket will also broadcast, but we want instant feedback)
      setComments((prev) => [newComment, ...prev]);
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to submit comment:', err);
      setError('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError('Failed to delete comment');
    }
  };

  // Organize comments into threads
  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parentId) {
      if (!acc[c.parentId]) acc[c.parentId] = [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {} as Record<string, Comment[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-zinc-100">
          Discussion
          {whiskeyName && <span className="text-zinc-500"> - {whiskeyName}</span>}
        </h3>
        <span className="text-sm text-zinc-500">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* New comment form */}
      <CommentForm
        onSubmit={(content) => handleSubmit(content)}
        isLoading={isSubmitting}
      />

      {/* Comments list */}
      {isLoading ? (
        <div className="text-center py-8 text-zinc-500">
          Loading comments...
        </div>
      ) : topLevelComments.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          No comments yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div className="space-y-3">
          {topLevelComments.map((comment) => (
            <div key={comment.id}>
              <CommentCard
                comment={comment}
                onDelete={comment.isOwn ? handleDelete : undefined}
                onReply={() => setReplyingTo(comment.id)}
                isReplying={replyingTo === comment.id}
              />
              {/* Replies */}
              {repliesByParent[comment.id]?.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  onDelete={reply.isOwn ? handleDelete : undefined}
                />
              ))}
              {/* Reply form */}
              {replyingTo === comment.id && (
                <div className="mt-2">
                  <CommentForm
                    onSubmit={(content) => handleSubmit(content, comment.id)}
                    onCancel={() => setReplyingTo(null)}
                    isLoading={isSubmitting}
                    placeholder="Write a reply..."
                    isReply
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
