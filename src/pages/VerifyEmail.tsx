import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button, Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/services/api';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();

  const email = location.state?.email || '';
  const devCode = location.state?.devCode;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [newDevCode, setNewDevCode] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email, or auto-send verification if coming from login (no devCode means no recent registration)
  useEffect(() => {
    if (!email) {
      navigate('/register');
      return;
    }
    // Auto-send verification email if we don't have a devCode (coming from login, not registration)
    if (!devCode && resendCooldown === 0) {
      handleResend();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');

    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.verifyEmail({ email, code: fullCode });
      // Access token is stored in httpOnly cookie by the backend
      setUser({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName,
        role: response.user.role,
      });
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (!email) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setNewDevCode(null);

    try {
      const response = await authApi.resendVerification({ email });
      setResendCooldown(60);
      if (response.devCode) {
        setNewDevCode(response.devCode);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const displayCode = newDevCode || devCode;

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Verify Your Email</h1>
          <p className="text-zinc-400 mt-2">
            We sent a 6-digit code to <span className="text-amber-500">{email}</span>
          </p>
        </div>

        <Card variant="elevated">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Development mode helper */}
              {displayCode && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-400">
                    Dev mode - Code: <span className="font-mono font-bold">{displayCode}</span>
                  </p>
                </div>
              )}

              {/* 6-digit code input */}
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

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
                Verify Email
              </Button>

              <div className="text-center">
                <p className="text-zinc-400 text-sm">
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isLoading}
                    className="text-amber-500 hover:text-amber-400 disabled:text-zinc-500 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link to="/register" className="text-zinc-500 hover:text-zinc-300 text-sm">
            Back to Register
          </Link>
        </div>
      </div>
    </div>
  );
}
