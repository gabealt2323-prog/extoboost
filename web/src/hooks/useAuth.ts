'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  api_key: string;
  unlocked_until: string | null;
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ks_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .getMe()
      .then((data) => {
        setUser(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        localStorage.removeItem('ks_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const isUnlocked = user?.unlocked_until
    ? new Date(user.unlocked_until) > new Date()
    : false;

  const logout = () => {
    localStorage.removeItem('ks_token');
    setUser(null);
  };

  return { user, loading, error, isUnlocked, logout };
}
