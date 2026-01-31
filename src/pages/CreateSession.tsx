import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Select, Card, CardHeader, CardContent, CardFooter } from '@/components/ui';
import { TemplateSelector } from '@/components/templates';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthStore } from '@/store/authStore';
import { useTemplateStore } from '@/store/templateStore';
import type { SessionTemplate } from '@/services/api';

// Helper to handle empty number inputs (valueAsNumber returns NaN for empty)
const optionalNumber = z.preprocess(
  (val) => (val === '' || Number.isNaN(val) ? undefined : val),
  z.number().optional()
);

const whiskeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  distillery: z.string().min(1, 'Distillery is required'),
  age: optionalNumber,
  proof: z.number().min(0).max(200),
  price: optionalNumber,
  pourSize: z.enum(['0.5oz', '1oz']),
});

const sessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  hostName: z.string().min(1, 'Your name is required'),
  theme: z.string().min(1, 'Theme is required'),
  customTheme: z.string().optional(),
  proofMin: optionalNumber,
  proofMax: optionalNumber,
  maxParticipants: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(2, 'Minimum 2 participants').max(50, 'Maximum 50 participants').optional()
  ),
  scheduledAt: z.string().optional(),
  whiskeys: z.array(whiskeySchema).min(1, 'Add at least one whiskey').max(6, 'Maximum 6 whiskeys'),
});

type SessionFormData = z.infer<typeof sessionSchema>;

const THEME_OPTIONS = [
  { value: 'bourbon', label: 'Bourbon' },
  { value: 'rye', label: 'Rye' },
  { value: 'scotch-single-malt', label: 'Scotch (Single Malt)' },
  { value: 'scotch-blended', label: 'Scotch (Blended)' },
  { value: 'irish', label: 'Irish' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'world', label: 'World Whiskey' },
  { value: 'custom', label: 'Custom Theme' },
];

const POUR_SIZE_OPTIONS = [
  { value: '0.5oz', label: '0.5 oz' },
  { value: '1oz', label: '1 oz' },
];

export function CreateSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createSession, isLoading, error } = useSessionStore();
  const { isAuthenticated } = useAuthStore();
  const { fetchTemplate, useTemplate } = useTemplateStore();
  const [step, setStep] = useState<'details' | 'flight'>('details');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      name: '',
      hostName: '',
      theme: 'bourbon',
      scheduledAt: '',
      whiskeys: [
        { name: '', distillery: '', age: undefined, proof: 90, price: undefined, pourSize: '0.5oz' as const },
      ],
    },
  });

  // Load template from URL parameter
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (templateId) {
      fetchTemplate(templateId).then((template) => {
        applyTemplate(template);
      }).catch((err) => {
        console.error('Failed to load template:', err);
      });
    }
  }, [searchParams, fetchTemplate]);

  const applyTemplate = (template: SessionTemplate | null) => {
    if (!template) {
      reset({
        name: '',
        hostName: '',
        theme: 'bourbon',
        scheduledAt: '',
        whiskeys: [
          { name: '', distillery: '', age: undefined, proof: 90, price: undefined, pourSize: '0.5oz' as const },
        ],
      });
      return;
    }

    // Mark template as used
    useTemplate(template.id).catch(() => {});

    // Apply template values
    setValue('theme', template.theme);
    if (template.customTheme) setValue('customTheme', template.customTheme);
    if (template.proofMin) setValue('proofMin', template.proofMin);
    if (template.proofMax) setValue('proofMax', template.proofMax);
    if (template.maxParticipants) setValue('maxParticipants', template.maxParticipants);

    // Apply whiskeys
    const whiskeysWithDefaults = template.whiskeys.map((w) => ({
      name: w.name || '',
      distillery: w.distillery || '',
      age: w.age,
      proof: w.proof || 90,
      price: w.price,
      pourSize: (w.pourSize || '0.5oz') as '0.5oz' | '1oz',
    }));

    setValue('whiskeys', whiskeysWithDefaults);
  };

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'whiskeys',
  });

  const theme = watch('theme');

  const onSubmit = async (data: SessionFormData) => {
    try {
      // Save as template if requested
      if (saveAsTemplate && templateName.trim()) {
        const { templatesApi } = await import('@/services/api');
        await templatesApi.create({
          name: templateName.trim(),
          theme: data.theme,
          customTheme: data.customTheme,
          proofMin: data.proofMin,
          proofMax: data.proofMax,
          maxParticipants: data.maxParticipants,
          whiskeys: data.whiskeys.map((w) => ({
            name: w.name,
            distillery: w.distillery,
            age: w.age,
            proof: w.proof,
            price: w.price,
            pourSize: w.pourSize,
          })),
        });
      }

      const result = await createSession({
        name: data.name,
        hostName: data.hostName,
        theme: data.theme,
        customTheme: data.customTheme,
        proofMin: data.proofMin,
        proofMax: data.proofMax,
        maxParticipants: data.maxParticipants,
        scheduledAt: data.scheduledAt || undefined,
        whiskeys: data.whiskeys.map((w) => ({
          name: w.name,
          distillery: w.distillery,
          age: w.age,
          proof: w.proof,
          price: w.price,
          pourSize: w.pourSize,
        })),
      });

      navigate(`/session/${result.id}/lobby`);
    } catch {
      // Error is already set in the store
    }
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
              You need to be logged in to create a tasting session.
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-zinc-400 hover:text-zinc-100 flex items-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-zinc-100">Create Tasting Session</h1>
          <p className="text-zinc-400 mt-2">Set up your blind tasting flight</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex gap-4 mb-8">
          <div
            className={`flex-1 p-3 rounded-lg cursor-pointer transition-colors ${
              step === 'details' ? 'bg-amber-500/20 border border-amber-500' : 'bg-zinc-800'
            }`}
            onClick={() => setStep('details')}
          >
            <span className="text-sm text-zinc-400">Step 1</span>
            <p className={`font-medium ${step === 'details' ? 'text-amber-500' : 'text-zinc-300'}`}>
              Session Details
            </p>
          </div>
          <div
            className={`flex-1 p-3 rounded-lg cursor-pointer transition-colors ${
              step === 'flight' ? 'bg-amber-500/20 border border-amber-500' : 'bg-zinc-800'
            }`}
            onClick={() => setStep('flight')}
          >
            <span className="text-sm text-zinc-400">Step 2</span>
            <p className={`font-medium ${step === 'flight' ? 'text-amber-500' : 'text-zinc-300'}`}>
              Build Flight
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: Session Details */}
          {step === 'details' && (
            <Card variant="elevated">
              <CardHeader
                title="Session Details"
                description="Name your tasting and select a theme"
              />
              <CardContent className="space-y-4">
                {/* Template Selector */}
                <TemplateSelector onSelect={applyTemplate} />

                <div className="border-t border-zinc-700 pt-4" />

                <Input
                  label="Session Name"
                  placeholder="e.g., Bourbon Showdown - January 2026"
                  error={errors.name?.message}
                  {...register('name')}
                />

                <Input
                  label="Your Name"
                  placeholder="e.g., John"
                  error={errors.hostName?.message}
                  {...register('hostName')}
                />

                <Select
                  label="Theme"
                  options={THEME_OPTIONS}
                  error={errors.theme?.message}
                  {...register('theme')}
                />

                {theme === 'custom' && (
                  <Input
                    label="Custom Theme"
                    placeholder="e.g., High-Proof Bourbons"
                    {...register('customTheme')}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Min Proof (Optional)"
                    type="number"
                    placeholder="e.g., 80"
                    {...register('proofMin', { valueAsNumber: true })}
                  />
                  <Input
                    label="Max Proof (Optional)"
                    type="number"
                    placeholder="e.g., 120"
                    {...register('proofMax', { valueAsNumber: true })}
                  />
                </div>

                <Input
                  label="Max Participants (Optional)"
                  type="number"
                  placeholder="Leave empty for unlimited"
                  hint="Limit how many people can join (2-50)"
                  error={errors.maxParticipants?.message}
                  {...register('maxParticipants', { valueAsNumber: true })}
                />

                <Input
                  label="Schedule For (Optional)"
                  type="datetime-local"
                  hint="Leave empty to start immediately, or set a future date/time"
                  {...register('scheduledAt')}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="button" onClick={() => setStep('flight')}>
                  Next: Build Flight
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Step 2: Build Flight */}
          {step === 'flight' && (
            <div className="space-y-4">
              <Card variant="elevated">
                <CardHeader
                  title="Build Your Flight"
                  description={`Add 1-6 whiskeys (${fields.length} added)`}
                />
                <CardContent className="space-y-6">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-4 bg-zinc-900 rounded-lg space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-amber-500 font-medium">
                          Whiskey #{index + 1}
                        </span>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Name"
                          placeholder="e.g., Buffalo Trace"
                          error={errors.whiskeys?.[index]?.name?.message}
                          {...register(`whiskeys.${index}.name`)}
                        />
                        <Input
                          label="Distillery"
                          placeholder="e.g., Buffalo Trace Distillery"
                          error={errors.whiskeys?.[index]?.distillery?.message}
                          {...register(`whiskeys.${index}.distillery`)}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <Input
                          label="Age (Optional)"
                          type="number"
                          placeholder="Years"
                          {...register(`whiskeys.${index}.age`, { valueAsNumber: true })}
                        />
                        <Input
                          label="Proof"
                          type="number"
                          placeholder="e.g., 90"
                          error={errors.whiskeys?.[index]?.proof?.message}
                          {...register(`whiskeys.${index}.proof`, { valueAsNumber: true })}
                        />
                        <Input
                          label="Price (Optional)"
                          type="number"
                          placeholder="$"
                          {...register(`whiskeys.${index}.price`, { valueAsNumber: true })}
                        />
                      </div>

                      <Select
                        label="Pour Size"
                        options={POUR_SIZE_OPTIONS}
                        {...register(`whiskeys.${index}.pourSize`)}
                      />
                    </div>
                  ))}

                  {fields.length < 6 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full border border-dashed border-zinc-700"
                      onClick={() =>
                        append({ name: '', distillery: '', age: undefined, proof: 90, price: undefined, pourSize: '0.5oz' as const })
                      }
                    >
                      + Add Another Whiskey
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Save as Template */}
              <Card variant="outlined" className="p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-zinc-300">Save as template for future use</span>
                </label>
                {saveAsTemplate && (
                  <div className="mt-3">
                    <Input
                      label="Template Name"
                      placeholder="e.g., My Bourbon Flight"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </div>
                )}
              </Card>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep('details')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  isLoading={isLoading}
                >
                  Create Session
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
