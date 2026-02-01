import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { notesLibraryApi } from '@/services/api';
import type { TastingNoteLibrary, TagCloudResponse } from '@/services/api';

interface NotesLibraryState {
  notes: TastingNoteLibrary[];
  currentNote: TastingNoteLibrary | null;
  tags: TagCloudResponse['tags'];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  filters: {
    search: string;
    category: string;
    tag: string;
  };
  isLoading: boolean;
  isLoadingTags: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchNotes: (page?: number) => Promise<void>;
  fetchNote: (id: string) => Promise<void>;
  fetchTags: () => Promise<void>;
  createNote: (data: Omit<TastingNoteLibrary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<TastingNoteLibrary | null>;
  updateNote: (id: string, data: Partial<Omit<TastingNoteLibrary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => Promise<TastingNoteLibrary | null>;
  deleteNote: (id: string) => Promise<boolean>;
  importScore: (scoreId: string) => Promise<TastingNoteLibrary | null>;
  setFilter: (key: keyof NotesLibraryState['filters'], value: string) => void;
  clearFilters: () => void;
  clearCurrentNote: () => void;
  clearError: () => void;
}

export const useNotesLibraryStore = create<NotesLibraryState>()(
  devtools(
    (set, get) => ({
      notes: [],
      currentNote: null,
      tags: [],
      pagination: null,
      filters: {
        search: '',
        category: '',
        tag: '',
      },
      isLoading: false,
      isLoadingTags: false,
      isSaving: false,
      error: null,

      fetchNotes: async (page = 1) => {
        set({ isLoading: true, error: null });

        try {
          const { filters } = get();
          const response = await notesLibraryApi.list({
            search: filters.search || undefined,
            category: filters.category || undefined,
            tag: filters.tag || undefined,
            page,
          });

          set({
            notes: page === 1
              ? response.notes
              : [...get().notes, ...response.notes],
            pagination: response.pagination,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      fetchNote: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const note = await notesLibraryApi.get(id);
          set({ currentNote: note, isLoading: false });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      fetchTags: async () => {
        set({ isLoadingTags: true });

        try {
          const response = await notesLibraryApi.getTags();
          set({ tags: response.tags, isLoadingTags: false });
        } catch (error) {
          console.error('Failed to fetch tags:', error);
          set({ isLoadingTags: false });
        }
      },

      createNote: async (data) => {
        set({ isSaving: true, error: null });

        try {
          const note = await notesLibraryApi.create(data);
          set({
            notes: [note, ...get().notes],
            isSaving: false,
          });
          return note;
        } catch (error) {
          set({
            error: (error as Error).message,
            isSaving: false,
          });
          return null;
        }
      },

      updateNote: async (id, data) => {
        set({ isSaving: true, error: null });

        try {
          const note = await notesLibraryApi.update(id, data);
          set({
            notes: get().notes.map(n => n.id === id ? note : n),
            currentNote: note,
            isSaving: false,
          });
          return note;
        } catch (error) {
          set({
            error: (error as Error).message,
            isSaving: false,
          });
          return null;
        }
      },

      deleteNote: async (id: string) => {
        set({ isSaving: true, error: null });

        try {
          await notesLibraryApi.delete(id);
          set({
            notes: get().notes.filter(n => n.id !== id),
            currentNote: null,
            isSaving: false,
          });
          return true;
        } catch (error) {
          set({
            error: (error as Error).message,
            isSaving: false,
          });
          return false;
        }
      },

      importScore: async (scoreId: string) => {
        set({ isSaving: true, error: null });

        try {
          const note = await notesLibraryApi.import(scoreId);
          set({
            notes: [note, ...get().notes],
            isSaving: false,
          });
          return note;
        } catch (error) {
          set({
            error: (error as Error).message,
            isSaving: false,
          });
          return null;
        }
      },

      setFilter: (key, value) => {
        set({
          filters: { ...get().filters, [key]: value },
          notes: [],
          pagination: null,
        });
        get().fetchNotes();
      },

      clearFilters: () => {
        set({
          filters: { search: '', category: '', tag: '' },
          notes: [],
          pagination: null,
        });
        get().fetchNotes();
      },

      clearCurrentNote: () => {
        set({ currentNote: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'notes-library-store' }
  )
);
