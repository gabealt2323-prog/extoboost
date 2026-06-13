'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NavBar from '@/components/NavBar';

function TrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token') || localStorage.getItem('ks_token');
    if (!token) { router.push('/login'); return; }
    localStorage.setItem('ks_token', token);

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/gateway-tokens`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([userData, linksData]) => {
        if (userData.error) { localStorage.removeItem('ks_token'); router.push('/login'); return; }
        setUser(userData);
        setLinks(linksData.error ? [] : linksData);
      })
      .catch(() => { localStorage.removeItem('ks_token'); router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  const handleSignOut = () => {
    localStorage.removeItem('ks_token');
    router.push('/login');
  };

  const completedCount = links.filter(l => l.status === 'completed').length;
  const pendingCount = links.filter(l => l.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar userName={user?.email} onSignOut={handleSignOut} />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white">Link Tracker</h2>
          <p className="text-gray-400 mt-1">Monitor your gateway link performance</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-surface-100 border border-surface-300">
            <p className="text-2xl font-bold text-white">{links.length}</p>
            <p className="text-sm text-gray-400">Total Links</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-100 border border-green-500/20">
            <p className="text-2xl font-bold text-green-400">{completedCount}</p>
            <p className="text-sm text-gray-400">Completed</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-100 border border-yellow-500/20">
            <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
            <p className="text-sm text-gray-400">Pending</p>
          </div>
        </div>

        {links.length === 0 ? (
          <div className="p-12 rounded-2xl bg-surface-100 border border-surface-300 text-center">
            <p className="text-gray-400">No links created yet. Go to Dashboard to create one.</p>
            <button onClick={() => router.push('/dashboard')} className="mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{link.player_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      link.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                      link.status === 'expired' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                    }`}>{link.status}</span>
                  </div>
                  <span className="text-xs text-gray-500">{link.provider}</span>
                </div>

                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-surface rounded-lg text-sm font-mono text-gray-400 truncate">
                    {`${window.location.origin}/gateway/${link.id}`}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/gateway/${link.id}`)}
                    className="px-3 py-2 bg-surface-200 hover:bg-surface-300 text-sm text-gray-300 rounded-lg transition-colors"
                  >
                    Copy
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <span className="text-gray-400">Created:</span>{' '}
                    {new Date(link.created_at).toLocaleString()}
                  </div>
                  {link.completed_at && (
                    <div>
                      <span className="text-gray-400">Completed:</span>{' '}
                      {new Date(link.completed_at).toLocaleString()}
                    </div>
                  )}
                  {link.code && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Code:</span>{' '}
                      <code className="text-primary-300">{link.code}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TrackerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
      <TrackerContent />
    </Suspense>
  );
}
