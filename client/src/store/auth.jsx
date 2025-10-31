import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/axios';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  const saveAuth = (token, u) => {
    if (token) localStorage.setItem('token', token);
    if (u) localStorage.setItem('user', JSON.stringify(u));
    if (u) setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null);
  };

  const me = async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch { /* token invalid */ logout(); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user) me();
  }, []); // eslint-disable-line

  const isAuthed = !!localStorage.getItem('token') || !!user;

  return (
    <AuthCtx.Provider value={{ user, setUser, saveAuth, logout, loading, setLoading, isAuthed }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
