import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export function Header() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, user } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-zinc-900 border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🥃</span>
            <span className="font-bold text-zinc-100 hidden sm:inline">Whiskey Canon Blinds</span>
            <span className="font-bold text-zinc-100 sm:hidden">WCB</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-zinc-800 text-amber-500'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              Home
            </Link>

            {isAuthenticated && (
              <Link
                to="/create"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/create')
                    ? 'bg-zinc-800 text-amber-500'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                Host
              </Link>
            )}

            <Link
              to="/join"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/join')
                  ? 'bg-zinc-800 text-amber-500'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              Join
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-zinc-800 text-amber-500'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                Admin
              </Link>
            )}

            <div className="w-px h-6 bg-zinc-700 mx-1 sm:mx-2" />

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/profile')
                      ? 'bg-zinc-800 text-amber-500'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-6 h-6 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {user?.avatarUrl ? (
                      <img
                        src={`${SERVER_URL}${user.avatarUrl}`}
                        alt={user.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">
                        {user?.displayName?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="hidden sm:inline">{user?.displayName}</span>
                </Link>
                <Link
                  to="/logout"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                  Logout
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  to="/login"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/login')
                      ? 'bg-zinc-800 text-amber-500'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
