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
        <a
          href="https://github.com/DamageLabs/whiskey-canon-blinds"
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center mt-2 text-zinc-500 hover:text-amber-500 transition-colors"
          aria-label="GitHub Repository"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>
    </footer>
  );
}
