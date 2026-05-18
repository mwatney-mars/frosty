import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchDevices, fetchMe, type DeviceState, type User } from './api';

interface DeviceContextType {
  devices: DeviceState[];
  setDevices: React.Dispatch<React.SetStateAction<DeviceState[]>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  refreshDevices: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const refreshDevices = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const data = await fetchDevices();
      setDevices(data);
    } catch (err: any) {
       // Silent background refresh
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        setLoading(false);
        return;
    }

    try {
      if (devices.length === 0) setLoading(true);
      const [devicesData, userData] = await Promise.all([
        fetchDevices(),
        fetchMe()
      ]);
      setDevices(devicesData);
      setUser(userData);
      setError(null);
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        setError('Failed to load data. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  }, [devices.length]);

  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // If already connecting or open, don't start another
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    console.log('[WS] Connecting...');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected');
      refreshDevices();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setDevices(data);
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      const tokenExists = !!localStorage.getItem('token');
      if (tokenExists) {
        console.log(`[WS] Disconnected (code: ${event.code}), retrying in 3s...`);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      } else {
        console.log('[WS] Disconnected (logged out)');
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };

    wsRef.current = ws;
  }, [refreshDevices]);

  // Handle Initial Load and Token Changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      refreshAll();
      connectWebSocket();
    }

    // Listener for login/logout across tabs or state updates
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      if (newToken) {
        refreshAll();
        connectWebSocket();
      } else {
        setUser(null);
        setDevices([]);
        wsRef.current?.close();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Check periodically for token (fallback for same-tab updates that don't trigger 'storage')
    const interval = setInterval(() => {
        const currentToken = localStorage.getItem('token');
        if (currentToken && !user && !loading) {
            refreshAll();
            connectWebSocket();
        }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [refreshAll, connectWebSocket, user, loading]);

  return (
    <DeviceContext.Provider value={{ 
      devices, setDevices, 
      user, setUser, 
      loading, error, setError, 
      refreshDevices, refreshAll 
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
}
