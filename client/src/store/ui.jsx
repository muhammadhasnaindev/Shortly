import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const UICtx = createContext(null);

export function UIProvider({ children }) {
  // Default to DARK if nothing is stored
  const getInitialTheme = () => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [createOpen, setCreateOpen] = useState(false);

  // Search (debounced public value)
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const [range, setRange] = useState('7d');
  const [linksVersion, setLinksVersion] = useState(0);
  const bumpLinksVersion = () => setLinksVersion(v => v + 1);

  const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' });
  const showToast = (msg, severity = 'success') => setToast({ open: true, msg, severity });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const value = useMemo(() => ({
    theme, setTheme, toggleTheme,
    createOpen, setCreateOpen,
    search, searchRaw, setSearchRaw,
    range, setRange,
    linksVersion, bumpLinksVersion,
    toast, showToast, closeToast,
  }), [theme, createOpen, search, searchRaw, range, linksVersion, toast]);

  return <UICtx.Provider value={value}>{children}</UICtx.Provider>;
}
export const useUI = () => useContext(UICtx);
