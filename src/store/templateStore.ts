import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  templatesApi,
  type SessionTemplate,
  type TemplateWhiskey,
} from '@/services/api';

interface TemplateState {
  templates: SessionTemplate[];
  selectedTemplate: SessionTemplate | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTemplates: () => Promise<void>;
  fetchTemplate: (templateId: string) => Promise<SessionTemplate>;
  createTemplate: (data: {
    name: string;
    theme: string;
    customTheme?: string;
    proofMin?: number;
    proofMax?: number;
    maxParticipants?: number;
    whiskeys: TemplateWhiskey[];
  }) => Promise<SessionTemplate>;
  updateTemplate: (templateId: string, data: Partial<{
    name: string;
    theme: string;
    customTheme?: string;
    proofMin?: number;
    proofMax?: number;
    maxParticipants?: number;
    whiskeys: TemplateWhiskey[];
  }>) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  useTemplate: (templateId: string) => Promise<void>;
  selectTemplate: (template: SessionTemplate | null) => void;
  clearError: () => void;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set, _get) => ({
      templates: [],
      selectedTemplate: null,
      isLoading: false,
      error: null,

      fetchTemplates: async () => {
        set({ isLoading: true, error: null });
        try {
          const templates = await templatesApi.getAll();
          set({ templates, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      fetchTemplate: async (templateId) => {
        set({ isLoading: true, error: null });
        try {
          const template = await templatesApi.get(templateId);
          set({ selectedTemplate: template, isLoading: false });
          return template;
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      createTemplate: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const template = await templatesApi.create(data);
          set((state) => ({
            templates: [template, ...state.templates],
            isLoading: false,
          }));
          return template;
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      updateTemplate: async (templateId, data) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await templatesApi.update(templateId, data);
          set((state) => ({
            templates: state.templates.map((t) =>
              t.id === templateId ? updated : t
            ),
            selectedTemplate:
              state.selectedTemplate?.id === templateId
                ? updated
                : state.selectedTemplate,
            isLoading: false,
          }));
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      deleteTemplate: async (templateId) => {
        set({ isLoading: true, error: null });
        try {
          await templatesApi.delete(templateId);
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== templateId),
            selectedTemplate:
              state.selectedTemplate?.id === templateId
                ? null
                : state.selectedTemplate,
            isLoading: false,
          }));
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      useTemplate: async (templateId) => {
        try {
          await templatesApi.use(templateId);
          // Increment local usage count
          set((state) => ({
            templates: state.templates.map((t) =>
              t.id === templateId
                ? { ...t, usageCount: t.usageCount + 1 }
                : t
            ),
          }));
        } catch (error) {
          // Non-critical, don't set error state
          console.error('Failed to track template usage:', error);
        }
      },

      selectTemplate: (template) => {
        set({ selectedTemplate: template });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'template-store' }
  )
);
