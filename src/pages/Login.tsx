import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { validateEmail } from '@/utils/validation';

const loginSchema = z.object({
  email: z.string().refine(
    (email: string) => validateEmail(email).valid,
    { message: 'Invalid email address' }
  ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Welcome Back</h1>
          <p className="text-zinc-400 mt-2">Sign in to your account</p>
        </div>

        <Card variant="elevated">
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                error={errors.password?.message}
                {...register('password')}
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
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-zinc-400 text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-amber-500 hover:text-amber-400">
                  Create one
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
