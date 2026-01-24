import { } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';

const parseInviteCode = (input: string): string => {
  return input.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
};

const isValidInviteCode = (code: string): boolean => {
  const parsed = parseInviteCode(code);
  return parsed.length === 6 && /^[A-Z0-9]+$/.test(parsed);
};

const joinSchema = z.object({
  inviteCode: z.string().refine(isValidInviteCode, 'Invalid invite code'),
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(20, 'Name must be 20 characters or less'),
});

type JoinFormData = z.infer<typeof joinSchema>;

export function JoinSessionPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code?: string }>();
  const { joinSessionByCode, isLoading, error } = useSessionStore();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      inviteCode: code ? parseInviteCode(code) : '',
      displayName: '',
    },
  });

  const onSubmit = async (data: JoinFormData) => {
    try {
      const sessionId = await joinSessionByCode(
        parseInviteCode(data.inviteCode),
        data.displayName
      );
      navigate(`/session/${sessionId}/lobby`);
    } catch {
      // Error is already set in the store
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInviteCode(e.target.value);
    setValue('inviteCode', parsed);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-zinc-400 hover:text-zinc-100 flex items-center gap-2 mx-auto mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-zinc-100">Join Tasting</h1>
          <p className="text-zinc-400 mt-2">Enter the session code to join</p>
        </div>

        <Card variant="elevated">
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Invite Code Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Session Code
                </label>
                <input
                  type="text"
                  maxLength={7}
                  placeholder="XXX-XXX"
                  className="w-full px-4 py-4 bg-zinc-800 border border-zinc-700 rounded-lg
                    text-2xl text-center tracking-[0.3em] font-mono text-zinc-100
                    placeholder-zinc-600 uppercase
                    focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  {...register('inviteCode', {
                    onChange: handleCodeChange,
                  })}
                />
                {errors.inviteCode && (
                  <p className="mt-2 text-sm text-red-400">{errors.inviteCode.message}</p>
                )}
              </div>

              {/* Display Name Input */}
              <Input
                label="Your Display Name"
                placeholder="What should we call you?"
                error={errors.displayName?.message}
                {...register('displayName')}
              />

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoading}
              >
                Join Session
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Don't have a code? Ask the host for the session invite code.
        </p>
      </div>
    </div>
  );
}
