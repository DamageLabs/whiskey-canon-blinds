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
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4 L8 28 C8 30 10 31 16 31 C22 31 24 30 24 28 L26 4 Z" fill="#3f3f46" stroke="#52525b" strokeWidth="1"/>
              <path d="M8 12 L9.5 26 C9.5 27.5 11 28.5 16 28.5 C21 28.5 22.5 27.5 22.5 26 L24 12 Z" fill="url(#whiskey-gradient-header)"/>
              <path d="M6 4 L26 4" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 6 L10 22" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
              <defs>
                <linearGradient id="whiskey-gradient-header" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b"/>
                  <stop offset="50%" stopColor="#d97706"/>
                  <stop offset="100%" stopColor="#b45309"/>
                </linearGradient>
              </defs>
            </svg>
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
              <>
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
                <Link
                  to="/analytics"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/analytics')
                      ? 'bg-zinc-800 text-amber-500'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  Analytics
                </Link>
              </>
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
