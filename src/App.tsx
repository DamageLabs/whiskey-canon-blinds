import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  HomePage,
  CreateSessionPage,
  JoinSessionPage,
  SessionLobbyPage,
  TastingSessionPage,
  RevealPage,
  LoginPage,
  RegisterPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  LogoutPage,
  AdminPage,
  ProfilePage,
  PublicProfilePage,
  FollowersPage,
  FollowingPage,
  TastingGuidePage,
  TemplatesPage,
  AnalyticsPage,
  LeaderboardsPage,
  NotesLibraryPage,
  MessagesPage,
  ConversationPage,
  AchievementsPage,
} from '@/pages';
import { Layout } from '@/components/layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Home */}
          <Route path="/" element={<HomePage />} />

          {/* Session Creation */}
          <Route path="/create" element={<CreateSessionPage />} />

          {/* Join Session */}
          <Route path="/join" element={<JoinSessionPage />} />
          <Route path="/join/:code" element={<JoinSessionPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminPage />} />

          {/* Guide */}
          <Route path="/guide" element={<TastingGuidePage />} />

          {/* Templates & Analytics */}
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />

          {/* New Features */}
          <Route path="/leaderboards" element={<LeaderboardsPage />} />
          <Route path="/notes" element={<NotesLibraryPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<ConversationPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />

          {/* Public Profiles */}
          <Route path="/user/:userId" element={<PublicProfilePage />} />
          <Route path="/user/:userId/followers" element={<FollowersPage />} />
          <Route path="/user/:userId/following" element={<FollowingPage />} />

          {/* Active Session */}
          <Route path="/session/:sessionId/lobby" element={<SessionLobbyPage />} />
          <Route path="/session/:sessionId/tasting" element={<TastingSessionPage />} />
          <Route path="/session/:sessionId/reveal" element={<RevealPage />} />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-zinc-100 mb-2">404</h1>
                  <p className="text-zinc-400">Page not found</p>
                </div>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
