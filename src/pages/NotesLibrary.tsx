import { useEffect, useState } from 'react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { useNotesLibraryStore } from '@/store/notesLibraryStore';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';
import type { TastingNoteLibrary } from '@/services/api';

const CATEGORIES = [
  { id: '', label: 'All Categories' },
  { id: 'bourbon', label: 'Bourbon' },
  { id: 'rye', label: 'Rye' },
  { id: 'scotch', label: 'Scotch' },
  { id: 'irish', label: 'Irish' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'canadian', label: 'Canadian' },
  { id: 'other', label: 'Other' },
];

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: TastingNoteLibrary;
  onEdit: (note: TastingNoteLibrary) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card variant="elevated" className="hover:border-zinc-600 transition-colors">
      <CardContent>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{note.whiskeyName}</h3>
            {note.distillery && (
              <p className="text-sm text-zinc-400">{note.distillery}</p>
            )}
          </div>
          {note.rating && (
            <div className="text-2xl font-bold text-amber-500">
              {note.rating.toFixed(1)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {note.category && (
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs capitalize">
              {note.category}
            </span>
          )}
          {note.age && (
            <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded-full text-xs">
              {note.age}yr
            </span>
          )}
          {note.proof && (
            <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded-full text-xs">
              {note.proof} proof
            </span>
          )}
          {note.isPublic && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
              Public
            </span>
          )}
        </div>

        {/* Notes Preview */}
        {(note.noseNotes || note.palateNotes || note.finishNotes) && (
          <div className="space-y-2 text-sm mb-3">
            {note.noseNotes && (
              <p className="text-zinc-300">
                <span className="text-zinc-500">Nose:</span> {note.noseNotes.substring(0, 100)}
                {note.noseNotes.length > 100 ? '...' : ''}
              </p>
            )}
            {note.palateNotes && (
              <p className="text-zinc-300">
                <span className="text-zinc-500">Palate:</span> {note.palateNotes.substring(0, 100)}
                {note.palateNotes.length > 100 ? '...' : ''}
              </p>
            )}
          </div>
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">
            {new Date(note.updatedAt).toLocaleDateString()}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(note)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(note.id)}>
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NoteEditor({
  note,
  onSave,
  onCancel,
  isSaving,
}: {
  note?: TastingNoteLibrary;
  onSave: (data: Partial<TastingNoteLibrary>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    whiskeyName: note?.whiskeyName || '',
    distillery: note?.distillery || '',
    category: note?.category || '',
    age: note?.age?.toString() || '',
    proof: note?.proof?.toString() || '',
    noseNotes: note?.noseNotes || '',
    palateNotes: note?.palateNotes || '',
    finishNotes: note?.finishNotes || '',
    generalNotes: note?.generalNotes || '',
    rating: note?.rating?.toString() || '',
    isPublic: note?.isPublic || false,
    tags: note?.tags?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      whiskeyName: formData.whiskeyName,
      distillery: formData.distillery || null,
      category: formData.category || null,
      age: formData.age ? parseInt(formData.age) : null,
      proof: formData.proof ? parseFloat(formData.proof) : null,
      noseNotes: formData.noseNotes || null,
      palateNotes: formData.palateNotes || null,
      finishNotes: formData.finishNotes || null,
      generalNotes: formData.generalNotes || null,
      rating: formData.rating ? parseFloat(formData.rating) : null,
      isPublic: formData.isPublic,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <Card variant="elevated">
      <CardContent>
        <h2 className="text-xl font-bold text-zinc-100 mb-4">
          {note ? 'Edit Note' : 'New Tasting Note'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Whiskey Name"
              value={formData.whiskeyName}
              onChange={(e) => setFormData({ ...formData, whiskeyName: e.target.value })}
              required
            />
            <Input
              label="Distillery"
              value={formData.distillery}
              onChange={(e) => setFormData({ ...formData, distillery: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select category</option>
                {CATEGORIES.slice(1).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Age (years)"
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
            />
            <Input
              label="Proof"
              type="number"
              step="0.1"
              value={formData.proof}
              onChange={(e) => setFormData({ ...formData, proof: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Nose Notes</label>
            <textarea
              value={formData.noseNotes}
              onChange={(e) => setFormData({ ...formData, noseNotes: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:ring-2 focus:ring-amber-500 min-h-[80px]"
              placeholder="Aromas and scents..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Palate Notes</label>
            <textarea
              value={formData.palateNotes}
              onChange={(e) => setFormData({ ...formData, palateNotes: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:ring-2 focus:ring-amber-500 min-h-[80px]"
              placeholder="Flavors and taste..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Finish Notes</label>
            <textarea
              value={formData.finishNotes}
              onChange={(e) => setFormData({ ...formData, finishNotes: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:ring-2 focus:ring-amber-500 min-h-[80px]"
              placeholder="Aftertaste and finish..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">General Notes</label>
            <textarea
              value={formData.generalNotes}
              onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:ring-2 focus:ring-amber-500 min-h-[80px]"
              placeholder="Overall impressions..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Rating (1-10)"
              type="number"
              min="1"
              max="10"
              step="0.1"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
            />
            <Input
              label="Tags (comma separated)"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="e.g., smooth, smoky, fruity"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="isPublic" className="text-sm text-zinc-300">
              Make this note public on your profile
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : note ? 'Update Note' : 'Create Note'}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function NotesLibraryPage() {
  const { isAuthenticated } = useAuthStore();
  const {
    notes,
    tags,
    pagination,
    filters,
    isLoading,
    isSaving,
    fetchNotes,
    fetchTags,
    createNote,
    updateNote,
    deleteNote,
    setFilter,
    clearFilters,
  } = useNotesLibraryStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState<TastingNoteLibrary | undefined>();
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    fetchNotes();
    fetchTags();
  }, [fetchNotes, fetchTags]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilter('search', searchInput);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchInput, filters.search, setFilter]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSave = async (data: Partial<TastingNoteLibrary>) => {
    if (editingNote) {
      await updateNote(editingNote.id, data);
    } else {
      await createNote(data as Omit<TastingNoteLibrary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
    }
    setIsEditing(false);
    setEditingNote(undefined);
  };

  const handleEdit = (note: TastingNoteLibrary) => {
    setEditingNote(note);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteNote(id);
    }
  };

  const loadMore = () => {
    if (pagination && pagination.page < pagination.totalPages) {
      fetchNotes(pagination.page + 1);
    }
  };

  if (isEditing) {
    return (
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <NoteEditor
            note={editingNote}
            onSave={handleSave}
            onCancel={() => {
              setIsEditing(false);
              setEditingNote(undefined);
            }}
            isSaving={isSaving}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">Tasting Notes Library</h1>
          <Button onClick={() => setIsEditing(true)}>New Note</Button>
        </div>

        {/* Search and Filters */}
        <Card variant="elevated" className="mb-6">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search notes..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <select
                value={filters.category}
                onChange={(e) => setFilter('category', e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:ring-2 focus:ring-amber-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
              {(filters.search || filters.category || filters.tag) && (
                <Button variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>

            {/* Tag Cloud */}
            {tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 15).map((t) => (
                    <button
                      key={t.tag}
                      onClick={() => setFilter('tag', filters.tag === t.tag ? '' : t.tag)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        filters.tag === t.tag
                          ? 'bg-amber-500 text-zinc-900'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      #{t.tag} ({t.count})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Grid */}
        {notes.length === 0 && !isLoading ? (
          <Card variant="outlined">
            <CardContent className="text-center py-12">
              <p className="text-zinc-400 mb-4">No tasting notes yet.</p>
              <Button onClick={() => setIsEditing(true)}>Create Your First Note</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8 text-zinc-400">Loading...</div>
        )}

        {/* Load More */}
        {pagination && pagination.page < pagination.totalPages && (
          <div className="text-center mt-6">
            <Button variant="secondary" onClick={loadMore} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
