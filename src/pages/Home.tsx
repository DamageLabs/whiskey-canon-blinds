import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';

export function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 pt-[10vh]">
      {/* Logo/Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-zinc-100 mb-2">
          Whiskey Canon
        </h1>
        <p className="text-xl text-amber-500 font-medium">Blind Tasting</p>
        <p className="text-zinc-400 mt-4 max-w-md">
          Host and participate in blind whiskey tastings with friends.
          Score independently, reveal together.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Create Session Card */}
        <Card variant="elevated" className="hover:border-amber-500/50 border border-transparent transition-colors">
          <CardHeader
            title="Host a Tasting"
            description="Create a new blind tasting session and invite participants"
          />
          <CardContent>
            <ul className="text-sm text-zinc-400 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Set up your flight (1-6 whiskeys)
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Invite participants with a code
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Control the reveal
              </li>
            </ul>
            <Link to="/create">
              <Button variant="primary" size="lg" className="w-full">
                Create Session
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Join Session Card */}
        <Card variant="elevated" className="hover:border-amber-500/50 border border-transparent transition-colors">
          <CardHeader
            title="Join a Tasting"
            description="Enter a session code to join an existing tasting"
          />
          <CardContent>
            <ul className="text-sm text-zinc-400 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Follow guided tasting protocol
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Score each whiskey independently
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                See results after the reveal
              </li>
            </ul>
            <Link to="/join">
              <Button variant="secondary" size="lg" className="w-full">
                Join Session
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
