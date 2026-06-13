'use client';

import { usePathname, useRouter } from 'next/navigation';

export default function NavBar({ userName, onSignOut }: { userName?: string; onSignOut?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Tracker', path: '/tracker' },
  ];

  return (
    <header className="border-b border-surface-300 bg-surface-100/50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-white cursor-pointer" onClick={() => router.push('/dashboard')}>Extoboost</h1>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.path}
                onClick={() => router.push(tab.path)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === tab.path
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-gray-400 hover:text-white hover:bg-surface-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{userName}</span>
          <button
            onClick={onSignOut}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
