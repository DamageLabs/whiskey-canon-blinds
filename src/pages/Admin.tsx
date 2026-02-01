import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  createdAt: string;
}

interface Session {
  id: string;
  name: string;
  theme: string;
  status: string;
  inviteCode: string;
  createdAt: string;
}

export function AdminPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'sessions'>('users');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchCsrfToken();
    fetchData();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchCsrfToken = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/csrf-token`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCsrfToken(data.csrfToken);
      }
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const fetchOptions = {
      credentials: 'include' as RequestCredentials, // Send httpOnly cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
    };

    try {
      const [usersRes, sessionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/users`, fetchOptions),
        fetch(`${API_BASE_URL}/admin/sessions`, fetchOptions),
      ]);

      if (!usersRes.ok || !sessionsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [usersData, sessionsData] = await Promise.all([
        usersRes.json(),
        sessionsRes.json(),
      ]);

      setUsers(usersData);
      setSessions(sessionsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include', // Send httpOnly cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }

      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include', // Send httpOnly cookies for authentication
        headers: {
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include', // Send httpOnly cookies for authentication
        headers: {
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete session');
      }

      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Admin Dashboard</h1>
            <p className="text-zinc-400 mt-1">Manage users and sessions</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'users' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('users')}
          >
            Users ({users.length})
          </Button>
          <Button
            variant={activeTab === 'sessions' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions ({sessions.length})
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Loading...</p>
          </div>
        ) : (
          <>
            {/* Users Tab */}
            {activeTab === 'users' && (
              <Card variant="elevated">
                <CardHeader title="Users" description="Manage user accounts and roles" />
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-700">
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Email</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Role</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Created</th>
                          <th className="text-right py-3 px-4 text-zinc-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-zinc-800">
                            <td className="py-3 px-4 text-zinc-100">{user.displayName}</td>
                            <td className="py-3 px-4 text-zinc-300">{user.email}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.role === 'admin'
                                    ? 'bg-amber-500/20 text-amber-500'
                                    : 'bg-zinc-700 text-zinc-300'
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-400">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    updateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                                  }
                                >
                                  {user.role === 'admin' ? 'Demote' : 'Promote'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => deleteUser(user.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <Card variant="elevated">
                <CardHeader title="Sessions" description="Manage tasting sessions" />
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-700">
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Theme</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Status</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Code</th>
                          <th className="text-left py-3 px-4 text-zinc-400 font-medium">Created</th>
                          <th className="text-right py-3 px-4 text-zinc-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((session) => (
                          <tr key={session.id} className="border-b border-zinc-800">
                            <td className="py-3 px-4 text-zinc-100">{session.name}</td>
                            <td className="py-3 px-4 text-zinc-300 capitalize">
                              {session.theme.replace('-', ' ')}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  session.status === 'active'
                                    ? 'bg-green-500/20 text-green-500'
                                    : session.status === 'completed'
                                    ? 'bg-zinc-700 text-zinc-300'
                                    : 'bg-amber-500/20 text-amber-500'
                                }`}
                              >
                                {session.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-400 font-mono">{session.inviteCode}</td>
                            <td className="py-3 px-4 text-zinc-400">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => deleteSession(session.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
