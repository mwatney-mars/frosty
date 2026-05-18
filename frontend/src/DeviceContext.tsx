import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchDevices, fetchMe, logout, type DeviceState, type User } from './api';

interface DeviceContextType {
  devices: DeviceState[];
  setDevices: React.Dispatch<React.SetStateAction<DeviceState[]>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  initialized: boolean;
  showOnboarding: boolean;
  setShowOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
  finishOnboarding: () => void;
  error: string | null;
  setError: (err: string | null) => void;
  refreshDevices: (force?: boolean) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const performLogout = useCallback(() => {
    logout();
    setToken(null);
    setUser(null);
    setDevices([]);
    setInitialized(true);
    setShowOnboarding(false);
    setLoading(false);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const finishOnboarding = useCallback(() => {
    console.log('[Onboarding] Manual finish -> closing screen');
    setShowOnboarding(false);
  }, []);

  const refreshDevices = useCallback(async (force = false) => {
    // HARD BLOCK background refreshes if onboarding is active
    if (showOnboarding && !force) {
        console.log('[Onboarding] Refresh BLOCKED while onboarding is active');
        return;
    }

    if (!localStorage.getItem('token')) return;
    try {
      const data = await fetchDevices();
      setDevices(data);
    } catch (err: any) {
       if (err.message === 'Unauthorized') performLogout();
    }
  }, [showOnboarding, performLogout]);

  const refreshAll = useCallback(async () => {
    const activeToken = localStorage.getItem('token');
    if (!activeToken) {
        setInitialized(true);
        return;
    }

    try {
      setLoading(true);
      const [devicesData, userData] = await Promise.all([
        fetchDevices(),
        fetchMe()
      ]);
      setDevices(devicesData);
      setUser(userData);
      setError(null);
      
      // Initial trigger for fresh installs
      if (devicesData.length === 0) {
          console.log('[Onboarding] 0 devices found -> opening onboarding');
          setShowOnboarding(true);
      } else {
          console.log('[Onboarding] Devices found -> hiding onboarding');
          setShowOnboarding(false);
      }
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        performLogout();
      } else {
        setError('Failed to load data. Is the backend running?');
      }
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [performLogout]);

  const connectWebSocket = useCallback(() => {
    const activeToken = localStorage.getItem('token');
    if (!activeToken) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    console.log('[WS] Connecting...');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('[WS] Connected');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
            // WS updates devices, but we've verified WS doesn't touch onboarding flag
            setDevices(data);
        }
      } catch (e) {}
    };
    ws.onclose = (event) => {
      wsRef.current = null;
      console.log(`[WS] Disconnected (code: ${event.code})`);
      if (localStorage.getItem('token')) {
        console.log('[WS] Retrying connection in 5 seconds...');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      }
    };
    ws.onerror = (err) => {
        console.error('[WS] Connection error:', err);
        ws.close();
    };
    wsRef.current = ws;
  }, []);

  // Sync token ONLY
  useEffect(() => {
    const syncToken = () => {
        const currentToken = localStorage.getItem('token');
        if (currentToken !== token) setToken(currentToken);
    };
    const interval = setInterval(syncToken, 2000);
    window.addEventListener('storage', syncToken);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', syncToken);
    };
  }, [token]);

  
  // HTTP Polling Fallback
  useEffect(() => {
    let pollInterval: any;
    
    // We check connection state dynamically inside the interval to avoid dependency loops
    if (token && !showOnboarding) {
        pollInterval = setInterval(() => {
            const isWsConnected = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
            if (!isWsConnected) {
                refreshDevices(true);
            }
        }, 4000);
    }

    return () => {
        if (pollInterval) clearInterval(pollInterval);
    };
  }, [token, showOnboarding, refreshDevices]);

  // Main lifecycle
  useEffect(() => {
    if (token) {
        refreshAll();
        connectWebSocket();
    } else {
        performLogout();
    }
    
    return () => {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); 

  return (
    <DeviceContext.Provider value={{ 
      devices, setDevices, 
      user, setUser, 
      loading, initialized, 
      showOnboarding, setShowOnboarding,
      finishOnboarding,
      error, setError, 
      refreshDevices, refreshAll 
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (context === undefined) throw new Error('useDevices must be used within a DeviceProvider');
  return context;
}
