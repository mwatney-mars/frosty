import { useEffect, useState, useRef } from 'react';
import { 
  Power, 
  Thermometer, 
  Wind, 
  RefreshCw, 
  Plus, 
  Minus,
  Settings2,
  Info,
  Sun, Snowflake,
  Droplets,
  Fan,
  Moon,
  Edit2,
  Check,
  LogOut,
  Users as UsersIcon
} from 'lucide-react';
import { fetchDevices, discoverDevices, updateDevice, logout, fetchMe, updateUserInfo, type DeviceState, type User } from './api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import WeatherWidget from './Weather';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FAN_SPEEDS = [
  { label: 'Auto', value: 0 },
  { label: 'Low', value: 1 },
  { label: 'Med-Low', value: 2 },
  { label: 'Med', value: 3 },
  { label: 'Med-High', value: 4 },
  { label: 'High', value: 5 },
];

const MODES = [
  { label: 'Auto', value: 0, icon: Settings2 },
  { label: 'Cool', value: 1, icon: Wind },
  { label: 'Dry', value: 2, icon: Droplets },
  { label: 'Fan', value: 3, icon: Fan },
  { label: 'Heat', value: 4, icon: Sun },
];

const TOGGLES = [
  { key: 'light', label: 'Display Light', type: 'bool' },
  { key: 'sleep', label: 'Sleep Mode', type: 'bool' },
  { key: 'turbo', label: 'Turbo', type: 'bool' },
  { key: 'quiet', label: 'Quiet', type: 'number' },
  { key: 'xfan', label: 'Blow (X-Fan)', type: 'bool' },
  { key: 'anion', label: 'Health (Anion)', type: 'bool' },
  { key: 'power_save', label: 'Power Save', type: 'bool' },
  { key: 'steady_heat', label: 'Steady Heat', type: 'bool' },
] as const;

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  
  const { isDark, toggleTheme } = useTheme();

  const [editingIp, setEditingIp] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (devices.length > 0 && !selectedIp) {
      setSelectedIp(devices[0].ip);
    } else if (devices.length > 0 && selectedIp) {
      if (!devices.find(d => d.ip === selectedIp)) {
        setSelectedIp(devices[0].ip);
      }
    }
  }, [devices, selectedIp]);

  const loadInitialData = async () => {
    try {
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
  };

  const loadDevices = async () => {
    try {
      const data = await fetchDevices();
      setDevices(data);
    } catch (err: any) {
      // Background reload failures are handled silently or via error state
    }
  };

  const handleDiscover = async () => {
    setLoading(true);
    try {
      await discoverDevices();
      await loadDevices();
    } catch (err) {
      setError('Discovery failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    loadInitialData();
    
    // Setup WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setDevices(data);
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    ws.onclose = () => console.log('WebSocket disconnected');

    return () => {
      ws.close();
    };
  }, []);

  const updateSetting = async (ip: string, updates: Partial<DeviceState>) => {
    try {
      setDevices(current => current.map(d => d.ip === ip ? { ...d, ...updates } : d));
      await updateDevice(ip, updates);
      await loadDevices();
    } catch (err) {
      setError('Failed to update device settings');
      await loadDevices();
    }
  };

  const startEditingName = (ip: string, currentName: string) => {
    setEditingIp(ip);
    setEditName(currentName || 'Gree AC');
    setTimeout(() => nameInputRef.current?.focus(), 10);
  };

  const saveName = async (mac: string) => {
    if (editName.trim()) {
      await updateSetting(mac, { name: editName.trim() });
    }
    setEditingIp(null);
  };

  const activeDevice = devices.find(d => d.ip === selectedIp);

  if (user?.requires_password_change) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-center w-12 h-12 bg-amber-100 text-amber-600 rounded-full mb-6 mx-auto">
            <LogOut className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">Change Default Password</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">
            For security reasons, you must change the default administrator password before continuing.
          </p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const pwd = fd.get('password') as string;
            if (pwd.length < 5) {
              alert('Password must be at least 5 characters');
              return;
            }
            try {
              await updateUserInfo(user.username, { password: pwd });
              setUser({ ...user, requires_password_change: false });
            } catch(err) {
              alert('Failed to update password');
            }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
              <input 
                name="password" 
                type="password" 
                required 
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Enter a secure password..."
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-md shadow-indigo-200 dark:shadow-none"
            >
              Update Password & Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-6 transition-colors duration-200 flex flex-col">
      <header className="max-w-5xl mx-auto w-full mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none text-center">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">Frosty</h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Smart AC Controller</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <WeatherWidget />
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {user?.is_admin && (
            <button 
              onClick={() => navigate('/users')}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors shadow-sm"
              aria-label="User Management"
            >
              <UsersIcon className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors shadow-sm"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDiscover}
            disabled={loading}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 md:px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            <span className="hidden sm:inline font-medium">Discover</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-3 shrink-0">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {devices.length === 0 && !loading ? (
          <div className="text-center py-24 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl my-auto">
            <div className="bg-slate-50 dark:bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings2 className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">No devices found</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Make sure your AC units are powered on and connected to the same Wi-Fi network as the server.</p>
            <button 
              onClick={handleDiscover}
              className="bg-indigo-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Start Discovery
            </button>
          </div>
        ) : (
          <>
            {/* Horizontal Device Selector */}
            {devices.length > 0 && (
              <div className="mb-6 shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
                  {devices.map(device => (
                    <button
                      key={device.ip}
                      onClick={() => setSelectedIp(device.ip)}
                      className={cn(
                        "flex items-center p-3 md:p-4 rounded-2xl border text-left transition-all duration-200 w-full relative overflow-hidden group",
                        selectedIp === device.ip
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-90 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-3">
                        
                        {/* Left: Icon & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-colors",
                            device.power 
                              ? (selectedIp === device.ip ? "bg-indigo-500 text-white shadow-md shadow-indigo-200 dark:shadow-none" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400")
                              : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                          )}>
                            {device.power ? (
                               device.mode === 1 ? <Snowflake className="w-5 h-5" /> :
                               device.mode === 2 ? <Droplets className="w-5 h-5" /> :
                               device.mode === 3 ? <Fan className="w-5 h-5" /> :
                               device.mode === 4 ? <Sun className="w-5 h-5" /> :
                               <Thermometer className="w-5 h-5" />
                            ) : <Power className="w-5 h-5" />}
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <span className={cn(
                              "font-bold text-sm md:text-base truncate block leading-tight",
                              selectedIp === device.ip ? "text-indigo-900 dark:text-indigo-100" : "text-slate-800 dark:text-slate-100"
                            )}>
                              {device.name || 'Gree AC'}
                            </span>
                            <span className={cn(
                              "text-[11px] md:text-xs truncate block mt-0.5",
                              device.power ? "text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-400 dark:text-slate-500"
                            )}>
                              {device.power ? `To ${device.target_temperature}°` : 'Standby'}
                            </span>
                          </div>
                        </div>

                        {/* Right: Current Temp */}
                        <div className="flex items-center shrink-0 pl-2 border-l border-slate-100 dark:border-slate-700/50">
                           <div className="text-sm md:text-base font-bold text-slate-600 dark:text-slate-300 w-8 text-right">
                             {device.current_temperature}°
                           </div>
                        </div>
                        
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Device Settings Pane */}
            {activeDevice && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-hidden transition-colors flex-1 flex flex-col">
                <div className="p-5 md:p-8 flex-1">
                  
                  {/* Pane Header */}
                  <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="overflow-hidden">
                      {editingIp === activeDevice.ip ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            ref={nameInputRef}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveName(activeDevice.ip)}
                            onBlur={() => saveName(activeDevice.ip)}
                            className="text-2xl md:text-3xl font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                          />
                          <button onClick={() => saveName(activeDevice.ip)} className="p-2 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors">
                            <Check className="w-6 h-6" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mb-1 group">
                          <h3 
                            className={cn("text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate", user?.is_admin && "cursor-pointer")} 
                            onClick={() => user?.is_admin && startEditingName(activeDevice.ip, activeDevice.name)}
                          >
                            {activeDevice.name || 'Gree AC'}
                          </h3>
                          {user?.is_admin && (
                            <button 
                              onClick={() => startEditingName(activeDevice.ip, activeDevice.name)}
                              className="p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md"
                              aria-label="Edit Name"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-slate-400 dark:text-slate-500 text-sm flex items-center gap-2">
                        <span className="font-mono">{activeDevice.ip}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>Status: {activeDevice.power ? 'Running' : 'Standby'}</span>
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => updateSetting(activeDevice.ip, { power: !activeDevice.power })}
                      className={cn(
                        "p-4 md:p-5 rounded-2xl transition-all duration-300 shrink-0 border ml-4",
                        activeDevice.power 
                          ? "bg-green-500 border-green-500 text-white shadow-[0_8px_16px_-6px_rgba(34,197,94,0.5)]" 
                          : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                      )}
                    >
                      <Power className="w-8 h-8 md:w-10 md:h-10" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
                    
                    {/* Left Column: Core Controls */}
                    <div className="lg:col-span-5 space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-3">
                            <Thermometer className="w-4 h-4" />
                            <span className="font-semibold uppercase tracking-wider text-xs">Indoor</span>
                          </div>
                          <div className="text-4xl font-bold text-slate-900 dark:text-white">{activeDevice.current_temperature}<span className="text-2xl text-slate-400">°C</span></div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                          <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400 text-sm mb-3">
                            <Settings2 className="w-4 h-4" />
                            <span className="font-semibold uppercase tracking-wider text-xs">Target</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-4xl font-bold text-indigo-900 dark:text-indigo-100">{activeDevice.target_temperature}<span className="text-2xl text-indigo-400 dark:text-indigo-500">°C</span></span>
                            <div className="flex flex-col gap-1.5 ml-2">
                              <button 
                                onClick={() => updateSetting(activeDevice.ip, { target_temperature: activeDevice.target_temperature + 1 })}
                                className="p-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-700 dark:text-indigo-300 transition-colors active:scale-95"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => updateSetting(activeDevice.ip, { target_temperature: activeDevice.target_temperature - 1 })}
                                className="p-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-700 dark:text-indigo-300 transition-colors active:scale-95"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Operating Mode</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {MODES.map((mode) => {
                            const Icon = mode.icon;
                            const isSelected = activeDevice.mode === mode.value;
                            return (
                              <button
                                key={mode.value}
                                onClick={() => updateSetting(activeDevice.ip, { mode: mode.value })}
                                className={cn(
                                  "flex flex-col items-center justify-center gap-2 py-3 px-1 text-xs font-semibold rounded-xl border transition-all",
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                                )}
                              >
                                <Icon className={cn("w-5 h-5", isSelected ? "text-indigo-100" : "text-slate-400")} />
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Fan Speed</h4>
                        <div className="flex flex-wrap gap-2">
                          {FAN_SPEEDS.map((speed) => (
                            <button
                              key={speed.value}
                              onClick={() => updateSetting(activeDevice.ip, { fan_speed: speed.value })}
                              className={cn(
                                "px-4 py-2.5 text-sm font-medium rounded-xl border transition-all flex-1 text-center whitespace-nowrap",
                                activeDevice.fan_speed === speed.value
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                              )}
                            >
                              {speed.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Advanced Controls */}
                    <div className="lg:col-span-7 space-y-8">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Airflow Direction</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <label className="block text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Vertical Swing</label>
                            <select 
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm"
                              value={activeDevice.swing_vertical}
                              onChange={(e) => updateSetting(activeDevice.ip, { swing_vertical: Number(e.target.value) })}
                            >
                              <option value={0}>Default / Sweep</option>
                              <option value={1}>Fixed (Highest)</option>
                              <option value={2}>Fixed (High)</option>
                              <option value={3}>Fixed (Middle)</option>
                              <option value={4}>Fixed (Low)</option>
                              <option value={5}>Fixed (Lowest)</option>
                            </select>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <label className="block text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Horizontal Swing</label>
                            <select 
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm"
                              value={activeDevice.horizontal_swing}
                              onChange={(e) => updateSetting(activeDevice.ip, { horizontal_swing: Number(e.target.value) })}
                            >
                              <option value={0}>Default / Sweep</option>
                              <option value={1}>Fixed (Far Left)</option>
                              <option value={2}>Fixed (Left)</option>
                              <option value={3}>Fixed (Center)</option>
                              <option value={4}>Fixed (Right)</option>
                              <option value={5}>Fixed (Far Right)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Features & Extras</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {TOGGLES.map((toggle) => {
                            const val = activeDevice[toggle.key as keyof DeviceState];
                            const isActive = toggle.type === 'bool' ? val as boolean : (val as number) > 0;
                            const nextValue = toggle.type === 'bool' ? !isActive : (isActive ? 0 : 1);
                            
                            return (
                              <button
                                key={toggle.key}
                                onClick={() => updateSetting(activeDevice.ip, { [toggle.key]: nextValue })}
                                className={cn(
                                  "flex flex-col items-start justify-between p-4 rounded-2xl border transition-all text-left min-h-[80px]",
                                  isActive
                                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/30 shadow-inner"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                                )}
                              >
                                <div className="flex w-full items-center justify-between mb-2">
                                  <div className={cn(
                                    "w-4 h-4 rounded-full border-2 transition-colors",
                                    isActive 
                                      ? "bg-indigo-500 border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                      : "bg-transparent border-slate-300 dark:border-slate-600"
                                  )} />
                                </div>
                                <span className={cn(
                                  "text-sm font-bold",
                                  isActive ? "text-indigo-900 dark:text-indigo-100" : "text-slate-600 dark:text-slate-400"
                                )}>{toggle.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </>
        )}
      </main>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
