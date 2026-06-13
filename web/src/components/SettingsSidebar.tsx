'use client';

import { useRef, useState, useEffect } from 'react';

export default function SettingsSidebar({ user, open, onClose, onUpdate }: {
  user: any; open: boolean; onClose: () => void; onUpdate: (u: any) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'account' | 'api'>('account');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [playerId, setPlayerId] = useState('');
  const [provider, setProvider] = useState('linkvertise');
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [copied, setCopied] = useState('');
  const [savedLinks, setSavedLinks] = useState<any[]>([]);

  useEffect(() => { setName(user?.name || ''); }, [user?.name]);

  useEffect(() => {
    if (!open || !user) return;
    fetchSavedLinks();
  }, [open, user]);

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

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true); setMessage('');
    try {
      const token = localStorage.getItem('ks_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (data.error) { setMessage(data.error); return; }
      onUpdate(data); setMessage('Name updated');
    } catch { setMessage('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const token = localStorage.getItem('ks_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_icon: base64 }),
      });
      const data = await res.json();
      if (!data.error) onUpdate(data);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure? The current API key will stop working immediately.')) return;
    try {
      const token = localStorage.getItem('ks_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/regenerate-api-key`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.api_key) {
        onUpdate({ ...user, api_key: data.api_key });
        setMessage('API key regenerated');
      }
    } catch { setMessage('Failed to regenerate'); }
  };

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
      if (data.error) { setMessage(data.error); return; }
      setGeneratedUrl(data.gatewayUrl);
      setVerifyUrl(data.verifyApiUrl);
      fetchSavedLinks();
    } catch { setMessage('Failed to generate'); }
    finally { setGenerating(false); }
  };

  const isImg = user?.profile_icon?.startsWith('data:');

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-80 bg-surface-100 border-l border-surface-300 shadow-2xl transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onMouseLeave={onClose}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300">
            <h2 className="text-lg font-bold text-white">Settings</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
          </div>

          <div className="flex border-b border-surface-300">
            <button onClick={() => setTab('account')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${tab === 'account' ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-400 hover:text-white'}`}>
              Account
            </button>
            <button onClick={() => setTab('api')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${tab === 'api' ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-400 hover:text-white'}`}>
              API & Gateway
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {tab === 'account' && (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-surface-200 border-2 border-surface-300 flex items-center justify-center overflow-hidden">
                    {isImg ? (
                      <img src={user.profile_icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                        {(user?.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <input ref={fileInput} type="file" accept=".png,.ico,.jpg,.jpeg,.gif,.webp" onChange={handleIconUpload} hidden />
                  <button onClick={() => fileInput.current?.click()} className="text-xs text-primary-400 hover:text-primary-300">Upload PNG / ICO</button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Display Name</label>
                  <div className="flex gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface border border-surface-300 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <button onClick={handleSaveName} disabled={saving}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white text-sm font-medium rounded-lg transition-colors">{saving ? '...' : 'Save'}</button>
                  </div>
                  {message && <p className="text-xs text-green-400">{message}</p>}
                </div>
              </>
            )}

            {tab === 'api' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">API Key</label>
                  <code className="block px-3 py-2 bg-surface rounded-lg text-sm font-mono text-primary-300 truncate">{user?.api_key}</code>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => { navigator.clipboard.writeText(user?.api_key); setMessage('Copied!'); }} className="text-primary-400 hover:text-primary-300">Copy</button>
                    <button onClick={handleRegenerateKey} className="text-red-400 hover:text-red-300">Regenerate</button>
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-300 space-y-4">
                  <label className="text-sm text-gray-400">Gateway Link Generator</label>
                  <div className="flex flex-col gap-3">
                    <input value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="Player ID / Name"
                      className="px-3 py-2 bg-surface border border-surface-300 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <select value={provider} onChange={(e) => setProvider(e.target.value)}
                      className="px-3 py-2 bg-surface border border-surface-300 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="linkvertise" className="bg-surface text-white">Linkvertise</option>
                      <option value="lootlabs" className="bg-surface text-white">LootLabs</option>
                    </select>
                    <button onClick={handleGenerate} disabled={generating || !playerId.trim()}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white text-sm font-medium rounded-lg transition-colors">
                      {generating ? '...' : 'Generate'}
                    </button>
                  </div>

                  {generatedUrl && (
                    <div className="p-3 rounded-xl bg-surface border border-primary-500/30 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-primary-400 mb-1">Gateway Link</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-2 py-1 bg-surface-200 rounded text-xs font-mono text-white truncate">{generatedUrl}</code>
                          <button onClick={() => { navigator.clipboard.writeText(generatedUrl); setCopied('gw'); setTimeout(() => setCopied(''), 2000); }}
                            className="px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors whitespace-nowrap">
                            {copied === 'gw' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      {verifyUrl && (
                        <div>
                          <p className="text-xs font-medium text-green-400 mb-1">Verify API Link</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-2 py-1 bg-surface-200 rounded text-xs font-mono text-green-300 truncate">{verifyUrl}</code>
                            <button onClick={() => { navigator.clipboard.writeText(verifyUrl); setCopied('vfy'); setTimeout(() => setCopied(''), 2000); }}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors whitespace-nowrap">
                              {copied === 'vfy' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {savedLinks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">Saved Links ({savedLinks.length})</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {savedLinks.slice(0, 5).map((link: any) => (
                          <div key={link.id} className="p-2 rounded-lg bg-surface border border-surface-300">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-white truncate">{link.player_id}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                link.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                link.status === 'expired' ? 'bg-red-500/10 text-red-400' :
                                'bg-yellow-500/10 text-yellow-400'
                              }`}>{link.status}</span>
                            </div>
                            <code className="block text-[10px] font-mono text-gray-500 truncate">{`${window.location.origin}/gateway/${link.id}`}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {message && <p className="text-xs text-green-400">{message}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}