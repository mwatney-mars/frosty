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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const data = await fetchDevices();
      setDevices(data);
    } catch (err: any) {
       // Silent background refresh
    }
  }, []);

  const refreshAll = useCallback(async () => {
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
    // If already connecting or open, don't start another
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    console.log('[WS] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected');
      refreshDevices(); // Fetch latest state once connected
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
      console.log(`[WS] Disconnected (code: ${event.code}), retrying in 3s...`);
      wsRef.current = null;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      // Let onclose handle reconnection
    };

    wsRef.current = ws;
  }, [refreshDevices]);

  useEffect(() => {
    refreshAll();
  }, []); // Only run once on mount

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnection loop during unmount
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

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
