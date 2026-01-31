import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardHeader, CardContent, Modal } from '@/components/ui';
import { useTemplateStore } from '@/store/templateStore';
import { useAuthStore } from '@/store/authStore';
import type { SessionTemplate } from '@/services/api';

export function TemplatesPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    templates,
    isLoading,
    error,
    fetchTemplates,
    deleteTemplate,
    clearError,
  } = useTemplateStore();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SessionTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTemplates();
    }
  }, [isAuthenticated, fetchTemplates]);

  const handleDeleteClick = (template: SessionTemplate) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(templateToDelete.id);
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    } catch {
      // Error handled in store
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card variant="elevated" className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">
              Authentication Required
            </h2>
            <p className="text-zinc-400 mb-6">
              You need to be logged in to manage templates.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button variant="primary" onClick={() => navigate('/register')}>
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/')}
              className="text-zinc-400 hover:text-zinc-100 flex items-center gap-2 mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-3xl font-bold text-zinc-100">Session Templates</h1>
            <p className="text-zinc-400 mt-2">Save and reuse your favorite session configurations</p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/create')}
          >
            Create Session
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
            <p className="text-red-400">{error}</p>
            <button onClick={clearError} className="text-red-400 hover:text-red-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-400">Loading templates...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && templates.length === 0 && (
          <Card variant="elevated">
            <CardContent className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-zinc-100 mb-2">No templates yet</h3>
              <p className="text-zinc-400 mb-6">
                Create a session and save it as a template to reuse later.
              </p>
              <Button variant="primary" onClick={() => navigate('/create')}>
                Create Your First Session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Templates Grid */}
        {templates.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id} variant="elevated" className="hover:border-zinc-600 transition-colors">
                <CardHeader
                  title={template.name}
                  description={`${template.theme}${template.customTheme ? ` (${template.customTheme})` : ''}`}
                />
                <CardContent>
                  <div className="space-y-3">
                    {/* Whiskey count */}
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>{template.whiskeys.length} whiskey{template.whiskeys.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Proof range */}
                    {(template.proofMin || template.proofMax) && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>
                          {template.proofMin || '0'} - {template.proofMax || '200'} proof
                        </span>
                      </div>
                    )}

                    {/* Max participants */}
                    {template.maxParticipants && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Max {template.maxParticipants} participants</span>
                      </div>
                    )}

                    {/* Usage count */}
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <span>Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>Created {formatDate(template.createdAt)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/create?template=${template.id}`)}
                      >
                        Use Template
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(template)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setTemplateToDelete(null);
          }}
          title="Delete Template"
        >
          <div className="space-y-4">
            <p className="text-zinc-300">
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setTemplateToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
                className="bg-red-600 hover:bg-red-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
