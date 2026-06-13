'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

function SuccessContent() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ adminName: string; apiKey: string; code: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const name = searchParams.get('name');
    const key = searchParams.get('key');
    const code = searchParams.get('code');

    if (name && key && code) {
      setData({ adminName: name, apiKey: key, code });
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/gateway-token/${token}/status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        if (d.status !== 'completed') return setError('Verification not yet complete');
        setData({ adminName: d.adminName, apiKey: d.apiKey, code: d.code });
      })
      .catch(() => setError('Failed to load key'));
  }, [token, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Verification Complete</h1>
        </div>

        <div className="p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-4 text-center">
          <p className="text-gray-300 text-lg">
            Heres your api key! {data.adminName} {data.apiKey}
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-surface-100 border border-primary-500/30 space-y-4 text-center">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Roblox System Key</h3>
          <div className="px-4 py-3 bg-surface rounded-lg">
            <code className="text-2xl font-mono font-bold text-primary-300 tracking-widest select-all">
              {data.code}
            </code>
          </div>
          <p className="text-xs text-gray-500">
            Enter this key in the Roblox client to complete verification
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-600">
            Share this with your player: {data.adminName} - {data.apiKey}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
      <SuccessContent />
    </Suspense>
  );
}
