import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-zinc-900 border-t border-zinc-800 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
          <Link to="/guide" className="text-zinc-400 hover:text-amber-500 text-sm transition-colors">
            Tasting Guide
          </Link>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <Link to="/create" className="text-zinc-400 hover:text-amber-500 text-sm transition-colors">
            Host a Tasting
          </Link>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <Link to="/join" className="text-zinc-400 hover:text-amber-500 text-sm transition-colors">
            Join a Session
          </Link>
        </div>
        <p className="text-zinc-400 text-sm mb-2 text-center">
          Taste responsibly. Score honestly.
        </p>
        <p className="text-zinc-500 text-sm text-center">
          &copy; 2025-2026 Whiskey Canon. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
