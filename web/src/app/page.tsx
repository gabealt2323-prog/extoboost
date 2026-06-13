'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'unlocked' | 'locked'>('loading');

  useEffect(() => {
    const token = localStorage.getItem('ks_token');
    if (!token) {
      setStatus('locked');
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          localStorage.removeItem('ks_token');
          setStatus('locked');
        } else {
          setStatus(data.unlocked_until && new Date(data.unlocked_until) > new Date() ? 'unlocked' : 'locked');
        }
      })
      .catch(() => setStatus('locked'));
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Extoboost</h1>
          <p className="text-gray-400">Key Verification & Authentication System</p>
        </div>

        {status === 'unlocked' ? (
          <div className="p-6 rounded-2xl bg-surface-100 border border-green-500/20 glow-green">
            <div className="text-green-400 text-lg font-semibold mb-2">System Unlocked</div>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-surface-100 border border-surface-300">
              <p className="text-gray-400 mb-4">Sign in to access the system</p>
              <button
                onClick={() => router.push('/login')}
                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
