import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { authApi } from '@/services/api';
import { validateEmail } from '@/utils/validation';

const forgotPasswordSchema = z.object({
  email: z.string().refine(
    (email: string) => validateEmail(email).valid,
    { message: 'Invalid email address' }
  ),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.forgotPassword({ email: data.email });
      setSuccess(true);
      // If devCode is returned (dev mode), navigate directly to reset page
      if (response.devCode) {
        navigate('/reset-password', {
          state: { email: data.email, devCode: response.devCode },
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/reset-password', { state: { email: getValues('email') } });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Forgot Password</h1>
          <p className="text-zinc-400 mt-2">Enter your email to receive a reset code</p>
        </div>

        <Card variant="elevated">
          <CardContent>
            {!success ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isLoading}
                >
                  Send Reset Code
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 text-center">
                    If that email exists, a password reset code has been sent.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleContinue}
                >
                  Enter Reset Code
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-zinc-400 text-sm">
                Remember your password?{' '}
                <Link to="/login" className="text-amber-500 hover:text-amber-400">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
