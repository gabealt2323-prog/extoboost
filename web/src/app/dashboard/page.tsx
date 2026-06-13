'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ApiKeyModal from '@/components/ApiKeyModal';
import NavBar from '@/components/NavBar';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [freshApiKey, setFreshApiKey] = useState('');
  const [freshUserName, setFreshUserName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [provider, setProvider] = useState('linkvertise');
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [copied, setCopied] = useState('');
  const [savedLinks, setSavedLinks] = useState<any[]>([]);
  const [verifyState, setVerifyState] = useState<'idle'|'sending'|'sent'|'verifying'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);

  const fetchSavedLinks = async () => {
    const token = localStorage.getItem('ks_token');
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gateway-tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.error) setSavedLinks(data);
    } catch {}
  };

  useEffect(() => {
    const token = searchParams.get('token') || localStorage.getItem('ks_token');
    const showKey = searchParams.get('showApiKey') === 'true';
    const apiKey = searchParams.get('apiKey') || '';
    const userName = searchParams.get('userName') || '';

    if (!token) {
      router.push('/login');
      return;
    }

    localStorage.setItem('ks_token', token);

    if (showKey && apiKey) {
      setFreshApiKey(apiKey);
      setFreshUserName(userName);
      setShowApiKey(true);
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          localStorage.removeItem('ks_token');
          router.push('/login?reason=password_changed');
          return;
        }
        setUser(data);
        if (!showKey && !apiKey) {
          setFreshApiKey(data.api_key);
          setFreshUserName(data.name);
        }
      })
      .catch(() => {
        localStorage.removeItem('ks_token');
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  useEffect(() => {
    if (user) fetchSavedLinks();
  }, [user]);

  const handleGenerate = async () => {
    if (!playerId.trim()) return;
    const token = localStorage.getItem('ks_token');
    if (!token) return;
    setGenerating(true);
    setGeneratedUrl('');
    setVerifyUrl('');
    setCopied('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerId.trim(), provider }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedUrl(data.gatewayUrl);
      setVerifyUrl(data.verifyApiUrl);
      fetchSavedLinks();
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  const handleSignOut = () => {
    localStorage.removeItem('ks_token');
    router.push('/login');
  };

  const isUnlocked = user?.unlocked_until && new Date(user.unlocked_until) > new Date();

  const maskEmail = (email: string) => email.replace(/(.{1,3})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

  const handleSendVerification = async () => {
    setVerifyState('sending');
    setVerifyError('');
    try {
      const token = localStorage.getItem('ks_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/send-verification`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) { setVerifyError(data.error); setVerifyState('idle'); return; }
      setVerifyState('sent');
    } catch { setVerifyError('Failed to send'); setVerifyState('idle'); }
  };

  const handleSubmitVerification = async () => {
    if (verifyCode.length !== 6) return;
    setVerifyState('verifying');
    setVerifyError('');
    try {
      const token = localStorage.getItem('ks_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/verify-email`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (data.error) { setVerifyError(data.error); setVerifyState('sent'); return; }
      setUser({ ...user, verified: true });
      setVerifyState('idle');
      setVerifyCode('');
    } catch { setVerifyError('Verification failed'); setVerifyState('sent'); }
  };

  return (
    <>
      <div className="min-h-screen bg-surface">
        <NavBar userName={user?.email} onSignOut={handleSignOut} />
        <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Welcome, {user?.name}</h2>
              <p className="text-gray-400 mt-1">Generate and manage player gateway links</p>
            </div>
            {user?.verified ? (
              <div className="px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
                Verified
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium">
                  Not Verified
                </div>
                {verifyState === 'idle' && (
                  <button onClick={handleSendVerification} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-full transition-colors">
                    Verify Email
                  </button>
                )}
                {verifyState === 'sending' && (
                  <div className="px-4 py-2 rounded-full bg-surface-200 text-gray-400 text-sm">Sending...</div>
                )}
                {verifyState === 'sent' && (
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs text-gray-400">
                      Extoboost has sent an email to {maskEmail(user?.email || '')}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text" maxLength={6} placeholder="Enter 6-digit code"
                        value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        className="w-36 px-3 py-2 bg-surface border border-surface-300 rounded-lg text-white text-sm text-center placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button onClick={handleSubmitVerification} disabled={verifyCode.length !== 6} className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                        {verifyState === 'verifying' ? '...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
                {verifyError && <span className="text-red-400 text-sm">{verifyError}</span>}
              </div>
            )}
          </div>

          <div className="p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-4">
            <h3 className="text-lg font-semibold text-white">API Key</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-surface rounded-lg text-sm font-mono text-primary-300 truncate">
                {user?.api_key}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(user?.api_key)}
                className="px-3 py-2 bg-surface-200 hover:bg-surface-300 rounded-lg text-sm text-gray-300 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500">Your unique API key for programmatic access</p>
          </div>

          <div className={`p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-6 ${!user?.verified ? 'opacity-40' : ''}`}>
            <h3 className="text-lg font-semibold text-white">Generate Player Gateway Link</h3>
            <p className="text-sm text-gray-400">
              Create a shareable gateway link for a player. They will complete an ad to receive their verification key.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="Player ID / Custom Name"
                className="flex-1 px-4 py-3 bg-surface border border-surface-300 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="px-4 py-3 bg-surface border border-surface-300 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.25rem',
                }}
              >
                <option value="linkvertise" className="bg-surface text-white">Linkvertise</option>
                <option value="lootlabs" className="bg-surface text-white">LootLabs</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (!user?.verified) { setShowVerifyPopup(true); return; }
                handleGenerate();
              }}
              disabled={generating || !playerId.trim()}
              className="w-full px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2 justify-center"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Player Gateway Link'
              )}
            </button>

            {generatedUrl && (
              <div className="p-4 rounded-xl bg-surface border border-primary-500/30 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-primary-400">Gateway Link</p>
                    <span className="text-xs text-gray-500">Share this with your player</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-surface-200 rounded-lg text-sm font-mono text-white truncate">
                      {generatedUrl}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedUrl); setCopied('gateway'); setTimeout(() => setCopied(''), 2000); }}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                      {copied === 'gateway' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-surface-300 pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-green-400">Verify API Link</p>
                    <span className="text-xs text-gray-500">For your key grabber / executor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-surface-200 rounded-lg text-sm font-mono text-green-300 truncate">
                      {verifyUrl}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(verifyUrl); setCopied('verify'); setTimeout(() => setCopied(''), 2000); }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                      {copied === 'verify' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Grabber calls <code className="text-gray-400">GET {verifyUrl}&amp;key=CODE</code> to check if the key is valid
                  </p>
                </div>
              </div>
            )}
          </div>

          {savedLinks.length > 0 && (
            <div className="p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-4">
              <h3 className="text-lg font-semibold text-white">Saved Links ({savedLinks.length})</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {savedLinks.map((link) => (
                  <div key={link.id} className="p-3 rounded-xl bg-surface border border-surface-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{link.player_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        link.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                        link.status === 'expired' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                        'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                      }`}>{link.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-surface-200 rounded text-xs font-mono text-gray-400 truncate">
                        {`${window.location.origin}/gateway/${link.id}`}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/gateway/${link.id}`); }}
                        className="px-2 py-1 bg-surface-200 hover:bg-surface-300 text-xs text-gray-300 rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {link.provider} &middot; {new Date(link.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(isUnlocked || user?.verified) && (
            <div className="p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-4">
              <h3 className="text-lg font-semibold text-white">Verification Status</h3>
              {user?.verified && <p className="text-green-400">Email verified</p>}
              {isUnlocked && <p className="text-green-400">System is unlocked</p>}
              <p className="text-sm text-gray-400">
                Valid until: {new Date(user.unlocked_until).toLocaleString()}
              </p>
            </div>
          )}
        </main>
      </div>

      {showVerifyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowVerifyPopup(false)}>
          <div className="p-8 rounded-2xl bg-surface-100 border border-surface-300 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white">Email Not Verified</h3>
            <p className="text-gray-400 text-sm">Your email is not verified. Please verify using the button below to access Player Gateway.</p>
            <button onClick={() => {
              setShowVerifyPopup(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors">
              Verify Now
            </button>
          </div>
        </div>
      )}

      {showApiKey && (
        <ApiKeyModal
          apiKey={freshApiKey}
          userName={freshUserName}
          onClose={() => setShowApiKey(false)}
        />
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
