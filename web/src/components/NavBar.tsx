'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import SettingsSidebar from './SettingsSidebar';

export default function NavBar({ userName, user, onSignOut, onUserUpdate }: {
  userName?: string; user?: any; onSignOut?: () => void; onUserUpdate?: (u: any) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isImg = user?.profile_icon?.startsWith('data:');

  const tabs = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Tracker', path: '/tracker' },
  ];

  return (
    <>
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
            <div className="relative" onMouseEnter={() => setSidebarOpen(true)}>
              <button className="w-9 h-9 rounded-full bg-surface-200 border-2 border-surface-300 overflow-hidden hover:border-primary-500 transition-colors cursor-pointer flex items-center justify-center">
                {isImg ? (
                  <img src={user?.profile_icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
                    {(user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
              </button>
            </div>
            <button onClick={onSignOut} className="text-sm text-gray-400 hover:text-white transition-colors">Sign out</button>
          </div>
        </div>
      </header>
      <SettingsSidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onUpdate={(u) => { onUserUpdate?.(u); }} />
    </>
  );
}
