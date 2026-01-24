import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSessionStore } from '@/store/sessionStore';

export function LogoutPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { reset } = useSessionStore();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
        reset();
      } finally {
        navigate('/');
      }
    };

    performLogout();
  }, [logout, reset, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-zinc-400">Logging out...</p>
    </div>
  );
}
