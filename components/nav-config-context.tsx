'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type NavFolder = {
  id: string;
  userId: string;
  name: string;
  icon: string;
  sortOrder: number;
};

export type NavItemOverride = {
  id: string;
  userId: string;
  routeKey: string;
  icon: string | null;
  folderId: string | null;
  sortOrder: number;
};

export type NavConfig = {
  folders: NavFolder[];
  items: NavItemOverride[];
};

type NavConfigContextType = {
  config: NavConfig | null;
  loading: boolean;
  refresh: () => void;
};

const NavConfigContext = createContext<NavConfigContextType>({
  config: null,
  loading: true,
  refresh: () => {},
});

export function NavConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<NavConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/nav/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // silently fail — sidebar falls back to defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  return (
    <NavConfigContext.Provider value={{ config, loading, refresh: fetchConfig }}>
      {children}
    </NavConfigContext.Provider>
  );
}

export function useNavConfig() {
  return useContext(NavConfigContext);
}
