import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardHeader, CardContent } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { validateEmail } from '@/utils/validation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const displayNameSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(30, 'Name must be 30 characters or less'),
});

const emailSchema = z.object({
  email: z.string().refine(
    (email) => validateEmail(email).valid,
    (email) => ({ message: validateEmail(email).error || 'Invalid email address' })
  ),
  password: z.string().min(1, 'Password is required to change email'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type DisplayNameFormData = z.infer<typeof displayNameSchema>;
type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser } = useAuthStore();
  const [activeSection, setActiveSection] = useState<'name' | 'email' | 'password' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const displayNameForm = useForm<DisplayNameFormData>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: user?.displayName || '' },
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email || '', password: '' },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }

  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const handleDisplayNameSubmit = async (data: DisplayNameFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/display-name`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ displayName: data.displayName }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update display name');
      }

      setUser({ ...user, displayName: result.displayName });
      setSuccessMessage('Display name updated successfully');
      setActiveSection(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/email`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update email');
      }

      setUser({ ...user, email: result.email });
      setSuccessMessage('Email updated successfully');
      setActiveSection(null);
      emailForm.reset({ email: result.email, password: '' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/password`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update password');
      }

      setSuccessMessage('Password updated successfully');
      setActiveSection(null);
      passwordForm.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Account Settings</h1>
          <p className="text-zinc-400 mt-2">Manage your profile and security settings</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Display Name Section */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Display Name"
            description="This is how other participants will see you in tasting sessions"
          />
          <CardContent>
            {activeSection === 'name' ? (
              <form onSubmit={displayNameForm.handleSubmit(handleDisplayNameSubmit)} className="space-y-4">
                <Input
                  label="New Display Name"
                  placeholder="Enter your display name"
                  error={displayNameForm.formState.errors.displayName?.message}
                  {...displayNameForm.register('displayName')}
                />
                <div className="flex gap-3">
                  <Button type="submit" variant="primary" isLoading={isLoading}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setActiveSection(null);
                      setError(null);
                      displayNameForm.reset({ displayName: user.displayName });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-zinc-100">{user.displayName}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveSection('name');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                >
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Section */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Email Address"
            description="Your email is used to log in and receive notifications"
          />
          <CardContent>
            {activeSection === 'email' ? (
              <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                <Input
                  label="New Email Address"
                  type="email"
                  placeholder="you@example.com"
                  error={emailForm.formState.errors.email?.message}
                  {...emailForm.register('email')}
                />
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="Enter your current password"
                  error={emailForm.formState.errors.password?.message}
                  {...emailForm.register('password')}
                />
                <div className="flex gap-3">
                  <Button type="submit" variant="primary" isLoading={isLoading}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setActiveSection(null);
                      setError(null);
                      emailForm.reset({ email: user.email, password: '' });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-zinc-100">{user.email}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveSection('email');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                >
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Password"
            description="Keep your account secure with a strong password"
          />
          <CardContent>
            {activeSection === 'password' ? (
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="Enter your current password"
                  error={passwordForm.formState.errors.currentPassword?.message}
                  {...passwordForm.register('currentPassword')}
                />
                <Input
                  label="New Password"
                  type="password"
                  placeholder="At least 6 characters"
                  error={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register('newPassword')}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Confirm your new password"
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword')}
                />
                <div className="flex gap-3">
                  <Button type="submit" variant="primary" isLoading={isLoading}>
                    Update Password
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setActiveSection(null);
                      setError(null);
                      passwordForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-zinc-400">••••••••</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveSection('password');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                >
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card variant="elevated">
          <CardHeader
            title="Account Information"
            description="Details about your account"
          />
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Account Type</span>
                <span className="text-zinc-100 capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">User ID</span>
                <span className="text-zinc-500 font-mono text-xs">{user.id}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
