import { useState, useEffect } from 'react';
import { useTemplateStore } from '@/store/templateStore';
import type { SessionTemplate } from '@/services/api';

interface TemplateSelectorProps {
  onSelect: (template: SessionTemplate | null) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { templates, isLoading, error, fetchTemplates } = useTemplateStore();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    fetchTemplates().catch(() => {
      // Error is handled in store
    });
  }, [fetchTemplates]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedId(templateId);

    if (!templateId) {
      onSelect(null);
      return;
    }

    const template = templates.find((t) => t.id === templateId);
    onSelect(template || null);
  };

  if (error) {
    return (
      <div className="text-sm text-red-400">
        Failed to load templates
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-300">
        Load from Template
      </label>
      <select
        value={selectedId}
        onChange={handleChange}
        disabled={isLoading}
        className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">
          {isLoading ? 'Loading templates...' : '-- Start from scratch --'}
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.whiskeys.length} whiskeys)
          </option>
        ))}
      </select>
      {selectedId && (
        <p className="text-xs text-zinc-500">
          Template will pre-fill the form below
        </p>
      )}
    </div>
  );
}
