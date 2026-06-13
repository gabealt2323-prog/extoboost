'use client';

import { useRef, useState } from 'react';

export default function SettingsSidebar({ user, open, onClose, onUpdate }: {
  user: any; open: boolean; onClose: () => void; onUpdate: (u: any) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

            <div className="pt-4 border-t border-surface-300 space-y-2">
              <label className="text-sm text-gray-400">API Key</label>
              <code className="block px-3 py-2 bg-surface rounded-lg text-sm font-mono text-primary-300 truncate">{user?.api_key}</code>
              <div className="flex gap-3 text-xs">
                <button onClick={() => { navigator.clipboard.writeText(user?.api_key); setMessage('Copied!'); }} className="text-primary-400 hover:text-primary-300">Copy</button>
                <button onClick={handleRegenerateKey} className="text-red-400 hover:text-red-300">Regenerate</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}