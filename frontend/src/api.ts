const API_BASE = import.meta.env.VITE_API_URL || '';

export interface DeviceState {
  mac: string;
  ip: string;
  name: string;
  online: boolean;
  power?: boolean;
  target_temperature?: number;
  current_temperature?: number;
  fan_speed?: number;
  mode?: number;
  swing_vertical?: number;
  horizontal_swing?: number;
  quiet?: number;
  turbo?: boolean;
  light?: boolean;
  sleep?: boolean;
  xfan?: boolean;
  anion?: boolean;
  power_save?: boolean;
  steady_heat?: boolean;
}

export interface DiscoveredDevice {
  mac: string;
  ip: string;
  name: string;
}

export interface User {
  username: string;
  is_admin: boolean;
  requires_password_change?: boolean;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const login = async (username: string, password: string) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const res = await fetch(`${API_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid username or password');
    throw new Error('Login failed');
  }

  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
};

export const logout = () => {
  localStorage.removeItem('token');
};

export const fetchMe = async (): Promise<User> => {
  const res = await fetch(`${API_BASE}/api/users/me`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
};

export const fetchUsers = async (): Promise<User[]> => {
  const res = await fetch(`${API_BASE}/api/users`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
};

export const createUser = async (user: any): Promise<User> => {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to create user');
  }
  return res.json();
};

export const updateUserInfo = async (username: string, updates: any): Promise<User> => {
  const res = await fetch(`${API_BASE}/api/users/${username}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
};

export const deleteUser = async (username: string) => {
  const res = await fetch(`${API_BASE}/api/users/${username}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
};

export const fetchDevices = async (): Promise<DeviceState[]> => {
  const res = await fetch(`${API_BASE}/api/devices`, {
    headers: getHeaders(),
  });
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
};

export const discoverDevices = async (): Promise<DiscoveredDevice[]> => {
  const res = await fetch(`${API_BASE}/api/discover`, { 
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to discover devices');
  return res.json();
};

export const saveDevice = async (mac: string, name: string, ip?: string): Promise<DeviceState> => {
  const res = await fetch(`${API_BASE}/api/devices`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ mac, name, ip }),
  });
  if (!res.ok) throw new Error('Failed to save device');
  return res.json();
};

export const deleteDevice = async (mac: string) => {
  const res = await fetch(`${API_BASE}/api/devices/${mac}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete device');
  return res.json();
};

export const updateDevice = async (mac: string, updates: Partial<DeviceState>) => {
  const res = await fetch(`${API_BASE}/api/devices/${mac}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update device');
  return res.json();
};
