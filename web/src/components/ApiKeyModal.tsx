'use client';

import { useEffect, useRef } from 'react';

interface ApiKeyModalProps {
  apiKey: string;
  userName: string;
  onClose: () => void;
}

export default function ApiKeyModal({ apiKey, userName, onClose }: ApiKeyModalProps) {
  const keyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const extractScript = () => {
      if (typeof window !== 'undefined' && apiKey && userName) {
        window.dispatchEvent(
          new CustomEvent('ks:apikey', {
            detail: { apiKey, userName, timestamp: Date.now() },
          })
        );
      }
    };
    extractScript();
  }, [apiKey, userName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 p-8 rounded-2xl bg-surface-100 border border-primary-500/30 glow-blue">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary-600 rounded-full text-xs font-semibold text-white uppercase tracking-wider">
          New Account
        </div>

        <div className="text-center space-y-6" ref={keyRef}>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">
              Heres your api key!
            </h2>
            <p className="text-gray-400">{userName}</p>
          </div>

          <div className="p-4 bg-surface rounded-xl border border-surface-300">
            <code className="text-sm font-mono text-primary-300 break-all select-all">
              {apiKey}
            </code>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-400">
              Save this key now. You won&apos;t be able to see it again.
            </p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(apiKey);
            }}
            className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            Copy API Key
          </button>

          <button
            onClick={onClose}
            className="w-full px-6 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            I&apos;ve saved my key
          </button>
        </div>
      </div>
    </div>
  );
}
