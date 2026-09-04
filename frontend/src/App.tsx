import { useEffect, useState, useId } from 'react';
import { 
  Power, 
  Thermometer, 
  Wind, 
  RefreshCw, 
  Plus, 
  Minus,
  Settings2,
  Info,
  Sun, 
  Snowflake,
  Droplets,
  Fan,
  Moon,
  Edit2,
  LogOut,
  AlertCircle,
  Settings,
  Volume2,
  VolumeX,
  Lock
} from 'lucide-react';
import { 
  discoverDevices, 
  updateDevice, 
  logout, 
  updateUserInfo, 
  saveDevice,
  type DeviceState, 
  type DiscoveredDevice 
} from './api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import { useDevices } from './DeviceContext';
import { useToast } from './ToastContext';
import { RenameModal } from './components/Modal';
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
  const { 
    devices, 
    addPendingUpdate,
    user, 
    setUser, 
    initialized, 
    showOnboarding, 
    finishOnboarding,
    error, 
    setError, 
    refreshDevices,
    wsStatus
  } = useDevices();

  const { showToast } = useToast();
  
  const [scanning, setScanning] = useState(false);
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [addingMacs, setAddingMacs] = useState<Set<string>>(new Set());
  
  const { isDark, toggleTheme } = useTheme();

  // Rename modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deviceToRename, setDeviceToRename] = useState<{ mac: string; name: string } | null>(null);

  // Announce state changes to screen readers
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');

  const verticalSwingId = useId();
  const horizontalSwingId = useId();
  const navigate = useNavigate();

  // Handle device selection
  useEffect(() => {
    if (devices.length > 0 && !selectedMac) {
      setSelectedMac(devices[0].mac);
    } else if (devices.length > 0 && selectedMac) {
      if (!devices.find(d => d.mac === selectedMac)) {
        setSelectedMac(devices[0].mac);
      }
    }
  }, [devices, selectedMac]);

  const handleInitialDiscover = async () => {
    setScanning(true);
    setError(null);
    try {
      const data = await discoverDevices();
      setDiscovered(data);
      if (data.length === 0) {
        showToast('No new devices found on network', 'info');
      } else {
        showToast(`Discovered ${data.length} AC unit(s)`, 'success');
      }
    } catch (err) {
      setError('Discovery failed. Please try again.');
      showToast('Discovery failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleAddInitial = async (device: DiscoveredDevice) => {
    setAddingMacs(prev => new Set(prev).add(device.mac));
    try {
      await saveDevice(device.mac, device.name, device.ip);
      setDiscovered(prev => prev.filter(d => d.mac !== device.mac));
      await refreshDevices();
      showToast(`Added ${device.name} to dashboard`, 'success');
    } catch (err) {
      showToast('Failed to add device', 'error');
    } finally {
      setAddingMacs(prev => {
        const next = new Set(prev);
        next.delete(device.mac);
        return next;
      });
    }
  };

  const handleLogout = () => {
    logout();
    showToast('Signed out successfully', 'info');
    navigate('/login');
  };

  const updateSetting = async (mac: string, updates: Partial<DeviceState>) => {
    addPendingUpdate(mac, updates);

    // Provide screen reader feedback
    if (updates.target_temperature !== undefined) {
      setSrAnnouncement(`Target temperature set to ${updates.target_temperature} degrees Celsius`);
    } else if (updates.power !== undefined) {
      setSrAnnouncement(updates.power ? 'AC powered on' : 'AC powered off');
    } else if (updates.mode !== undefined) {
      const modeLabel = MODES.find(m => m.value === updates.mode)?.label || 'Auto';
      setSrAnnouncement(`Mode changed to ${modeLabel}`);
    }

    try {
      await updateDevice(mac, updates);
      setTimeout(() => refreshDevices(true), 1200);
    } catch (err) {
      setError('Failed to update device settings');
      showToast('Failed to communicate with AC unit', 'error');
      refreshDevices(true);
    }
  };

  const startRename = (mac: string, currentName: string) => {
    setDeviceToRename({ mac, name: currentName || 'Gree AC' });
    setRenameModalOpen(true);
  };

  const saveRename = async (newName: string) => {
    if (deviceToRename && newName.trim()) {
      await updateSetting(deviceToRename.mac, { name: newName.trim() });
      showToast(`Device renamed to "${newName.trim()}"`, 'success');
    }
    setRenameModalOpen(false);
    setDeviceToRename(null);
  };

  const activeDevice = devices.find(d => d.mac === selectedMac);

  if (user?.requires_password_change) {
    return (
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwd-change-title"
      >
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
          <div className="flex items-center justify-center w-14 h-14 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl mb-6 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 id="pwd-change-title" className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
            Change Default Password
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-center mb-6 text-sm">
            For security reasons, you must change the default administrator password before accessing device controls.
          </p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const pwd = fd.get('password') as string;
            if (!pwd || pwd.length < 8) {
              showToast('Password must be at least 8 characters long', 'error');
              return;
            }
            try {
              await updateUserInfo(user.username, { password: pwd });
              setUser({ ...user, requires_password_change: false });
              showToast('Password updated successfully! Welcome to Frosty.', 'success');
            } catch(err: any) {
              showToast(err?.message || 'Failed to update password', 'error');
            }
          }} className="space-y-5">
            <div>
              <label htmlFor="new-admin-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                New Password (min 8 chars)
              </label>
              <input 
                id="new-admin-password"
                name="password" 
                type="password" 
                required 
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-base"
                placeholder="Enter new secure password..."
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
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
      {/* Screen Reader Live Status Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* Rename Modal */}
      {deviceToRename && (
        <RenameModal
          isOpen={renameModalOpen}
          currentName={deviceToRename.name}
          onSave={saveRename}
          onCancel={() => {
            setRenameModalOpen(false);
            setDeviceToRename(null);
          }}
        />
      )}

      {/* App Header */}
      <header className="max-w-5xl mx-auto w-full mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none text-center shrink-0">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">Frosty</h1>
              {initialized && !showOnboarding && (
                <div 
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                    wsStatus === 'connected' ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" :
                    wsStatus === 'connecting' ? "bg-amber-500 animate-pulse" :
                    "bg-rose-500"
                  )}
                  role="status"
                  aria-label={
                    wsStatus === 'connected' ? "Connected live via WebSocket" :
                    wsStatus === 'connecting' ? "Connecting to WebSocket" :
                    "Disconnected, using polling fallback"
                  }
                  title={
                    wsStatus === 'connected' ? "Live Connected" :
                    wsStatus === 'connecting' ? "Connecting..." :
                    "Disconnected (Polling Fallback)"
                  }
                />
              )}
            </div>
            <div className="flex items-center mt-1 flex-wrap">
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium">
                Smart AC Controller
                {initialized && !showOnboarding && (
                  <span className="text-[10px] ml-1 text-slate-500 dark:text-slate-400 font-normal">
                    ({wsStatus === 'connected' ? 'live' : wsStatus === 'connecting' ? 'connecting' : 'polling'})
                  </span>
                )}
              </p>
              <div className="flex sm:hidden">
                <WeatherWidget variant="inline" />
              </div>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          <WeatherWidget />
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {user?.is_admin && (
            <button 
              onClick={() => navigate('/settings')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Open Settings and Device Management"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Log out of Frosty"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        {error && (
          <div 
            className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-2xl mb-6 flex items-center gap-3 shrink-0"
            role="alert"
          >
            <Info className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {!initialized ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-slate-500 dark:text-slate-400">
               <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
               <p className="font-semibold text-base">Connecting to Frosty...</p>
            </div>
          </div>
        ) : showOnboarding ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="text-center max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 md:p-12 rounded-3xl shadow-xl">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <RefreshCw className={cn("w-12 h-12 text-indigo-600 dark:text-indigo-400", scanning && "animate-spin")} />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Welcome to Frosty</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-10 leading-relaxed text-base md:text-lg">
                To get started, let's discover your Gree AC units on the local network. 
                Please ensure your AC units are powered and connected to Wi-Fi.
              </p>
              
              {discovered.length > 0 ? (
                <div className="space-y-4 text-left mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Found {discovered.length} Devices</h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    {discovered.map(d => (
                      <div key={d.mac} className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{d.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{d.ip} • {d.mac}</p>
                        </div>
                        <button 
                          onClick={() => handleAddInitial(d)}
                          disabled={addingMacs.has(d.mac)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          {addingMacs.has(d.mac) ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Adding...</span>
                            </>
                          ) : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleInitialDiscover}
                  disabled={scanning}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-base md:text-lg transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    discovered.length > 0 
                      ? "bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none"
                  )}
                >
                  {scanning ? 'Searching network...' : (discovered.length > 0 ? 'Scan Again' : 'Scan for Devices')}
                </button>

                {devices.length > 0 && (
                  <button 
                    onClick={finishOnboarding}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold text-base md:text-lg transition-all shadow-lg shadow-emerald-200 dark:shadow-none active:scale-[0.98] min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    Finish Setup ({devices.length} Ready)
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Horizontal Device Selector Tabs */}
            {devices.length > 0 && (
              <section aria-label="Discovered AC Units" className="mb-6 shrink-0">
                <div role="tablist" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {devices.map(device => {
                    const isSelected = selectedMac === device.mac;
                    return (
                      <button
                        key={device.mac}
                        role="tab"
                        aria-selected={isSelected}
                        aria-label={`${device.name || 'Gree AC'}, ${device.online ? (device.power ? `Running, target ${device.target_temperature}°C` : 'Standby') : 'Offline'}, current ${device.online ? device.current_temperature : '--'}°C`}
                        onClick={() => setSelectedMac(device.mac)}
                        className={cn(
                          "flex items-center p-3.5 md:p-4 rounded-2xl border text-left transition-all duration-200 w-full relative overflow-hidden group min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm ring-2 ring-indigo-500/50"
                            : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm",
                          !device.online && "opacity-75"
                        )}
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          
                          {/* Left: Icon & Info */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={cn(
                              "flex items-center justify-center w-11 h-11 rounded-2xl shrink-0 transition-colors",
                              !device.online 
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300"
                                : device.power 
                                  ? (isSelected ? "bg-indigo-600 text-white shadow-md shadow-indigo-300 dark:shadow-none" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300")
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
                            )}>
                              {!device.online ? <AlertCircle className="w-5 h-5" /> : 
                               device.power ? (
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
                                isSelected ? "text-indigo-950 dark:text-indigo-100" : "text-slate-900 dark:text-slate-100"
                              )}>
                                {device.name || 'Gree AC'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {!device.online ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                    Offline
                                  </span>
                                ) : (
                                  <span className={cn(
                                    "text-xs font-semibold truncate",
                                    device.power ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                                  )}>
                                    {device.power ? `Target ${device.target_temperature}°` : 'Standby'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Current Temp */}
                          <div className="flex items-center shrink-0 pl-2 border-l border-slate-100 dark:border-slate-700/60">
                             <div className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 w-9 text-right">
                               {device.online ? `${device.current_temperature}°C` : '--'}
                             </div>
                          </div>
                          
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Active Device Settings Pane */}
            {activeDevice && (
              <section 
                aria-label={`Controls for ${activeDevice.name || 'Selected AC'}`}
                className={cn(
                  "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-hidden transition-all flex-1 flex flex-col relative",
                  !activeDevice.online && "opacity-90"
                )}
              >
                {!activeDevice.online && (
                  <div className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/60 backdrop-blur-[2px] z-40 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-800/60 text-center max-w-sm">
                       <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
                         <AlertCircle className="w-7 h-7" />
                       </div>
                       <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Device Offline</h3>
                       <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                         Frosty cannot reach this AC unit on the network. Please verify that the unit is powered on and connected to Wi-Fi.
                       </p>
                    </div>
                  </div>
                )}

                <div className="p-5 md:p-8 flex-1">
                  
                  {/* Pane Header */}
                  <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 mb-1 group">
                        <h2 
                          className={cn("text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate", user?.is_admin && "cursor-pointer")} 
                          onClick={() => user?.is_admin && startRename(activeDevice.mac, activeDevice.name)}
                          title={user?.is_admin ? "Click to rename" : undefined}
                        >
                          {activeDevice.name || 'Gree AC'}
                        </h2>
                        {user?.is_admin && (
                          <button 
                            onClick={() => startRename(activeDevice.mac, activeDevice.name)}
                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            aria-label={`Rename ${activeDevice.name || 'device'}`}
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      
                      <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{activeDevice.ip}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
                        <span className="font-medium">
                          Status: {activeDevice.online ? (activeDevice.power ? 'Running' : 'Standby') : 'Offline'}
                        </span>
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {/* Silence Beep Switch */}
                      <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-2xl h-12 md:h-[52px] transition-colors">
                        <span id="beep-label" className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 select-none">
                          Beep
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={activeDevice.mute_beep}
                          aria-labelledby="beep-label"
                          onClick={() => updateSetting(activeDevice.mac, { mute_beep: !activeDevice.mute_beep })}
                          disabled={!activeDevice.online}
                          className={cn(
                            "w-12 h-7 rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 relative shrink-0 disabled:opacity-50",
                            activeDevice.mute_beep 
                              ? "bg-indigo-600" 
                              : "bg-slate-300 dark:bg-slate-700"
                          )}
                        >
                          <span className="sr-only">Toggle mute beep sound</span>
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 flex items-center justify-center absolute left-0.5 top-0.5",
                              activeDevice.mute_beep ? "translate-x-5" : "translate-x-0"
                            )}
                          >
                            {activeDevice.mute_beep ? (
                              <VolumeX className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Power Button */}
                      <button 
                        type="button"
                        role="button"
                        aria-pressed={activeDevice.power}
                        aria-label={activeDevice.power ? "Turn AC off" : "Turn AC on"}
                        onClick={() => updateSetting(activeDevice.mac, { power: !activeDevice.power })}
                        disabled={!activeDevice.online}
                        className={cn(
                          "p-3 md:p-3.5 rounded-2xl transition-all duration-300 border h-12 w-12 md:h-[52px] md:w-[52px] flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50",
                          activeDevice.online && activeDevice.power 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-700" 
                            : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                        )}
                      >
                        <Power className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Controls Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
                    
                    {/* Left Column: Core Controls */}
                    <div className="lg:col-span-5 space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Indoor Current Temp */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-center">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm mb-3">
                            <Thermometer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-bold uppercase tracking-wider text-xs">Indoor</span>
                          </div>
                          <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                            {activeDevice.online ? activeDevice.current_temperature : '--'}
                            <span className="text-2xl text-slate-500 dark:text-slate-400 font-semibold ml-0.5">°C</span>
                          </div>
                        </div>

                        {/* Target Temp with Controls */}
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/40">
                          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-sm mb-3">
                            <Settings2 className="w-4 h-4" />
                            <span className="font-bold uppercase tracking-wider text-xs">Target</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-4xl font-extrabold text-indigo-950 dark:text-indigo-100">
                              {activeDevice.online ? activeDevice.target_temperature : '--'}
                              <span className="text-2xl text-indigo-500 dark:text-indigo-400 font-semibold ml-0.5">°C</span>
                            </span>
                            <div className="flex flex-col gap-2 ml-2">
                              <button 
                                type="button"
                                aria-label="Increase target temperature by 0.5 degrees Celsius"
                                disabled={!activeDevice.online || activeDevice.target_temperature === undefined || activeDevice.target_temperature >= 30}
                                onClick={() => activeDevice.target_temperature !== undefined && updateSetting(activeDevice.mac, { target_temperature: Math.min(30, Math.round((activeDevice.target_temperature + 0.5) * 2) / 2) })}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-800 bg-indigo-100 dark:bg-indigo-900/60 rounded-xl text-indigo-800 dark:text-indigo-200 transition-all active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                              <button 
                                type="button"
                                aria-label="Decrease target temperature by 0.5 degrees Celsius"
                                disabled={!activeDevice.online || activeDevice.target_temperature === undefined || activeDevice.target_temperature <= 16}
                                onClick={() => activeDevice.target_temperature !== undefined && updateSetting(activeDevice.mac, { target_temperature: Math.max(16, Math.round((activeDevice.target_temperature - 0.5) * 2) / 2) })}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-800 bg-indigo-100 dark:bg-indigo-900/60 rounded-xl text-indigo-800 dark:text-indigo-200 transition-all active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Operating Mode */}
                      <fieldset>
                        <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                          Operating Mode
                        </legend>
                        <div role="radiogroup" aria-label="Operating Mode" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {MODES.map((mode) => {
                            const Icon = mode.icon;
                            const isSelected = activeDevice.mode === mode.value;
                            return (
                              <button
                                key={mode.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Mode: ${mode.label}`}
                                disabled={!activeDevice.online}
                                onClick={() => updateSetting(activeDevice.mac, { mode: mode.value })}
                                className={cn(
                                  "flex flex-col items-center justify-center gap-2 py-3.5 px-2 text-xs font-bold rounded-2xl border transition-all min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50",
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                )}
                              >
                                <Icon className={cn("w-5 h-5", isSelected ? "text-white" : "text-slate-500 dark:text-slate-400")} />
                                <span>{mode.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>

                      {/* Fan Speed */}
                      <fieldset>
                        <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                          Fan Speed
                        </legend>
                        <div role="radiogroup" aria-label="Fan Speed" className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {FAN_SPEEDS.map((speed) => {
                            const isSelected = activeDevice.fan_speed === speed.value;
                            return (
                              <button
                                key={speed.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Fan speed: ${speed.label}`}
                                disabled={!activeDevice.online}
                                onClick={() => updateSetting(activeDevice.mac, { fan_speed: speed.value })}
                                className={cn(
                                  "px-2 py-3 text-xs font-bold rounded-xl border transition-all text-center whitespace-nowrap min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50",
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                )}
                              >
                                {speed.label}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>

                    {/* Right Column: Advanced Controls */}
                    <div className="lg:col-span-7 space-y-8">
                      {/* Airflow Direction */}
                      <section aria-labelledby="airflow-heading">
                        <h3 id="airflow-heading" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                          Airflow Direction
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                            <label htmlFor={verticalSwingId} className="block text-xs text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider mb-2">
                              Vertical Swing
                            </label>
                            <select 
                              id={verticalSwingId}
                              disabled={!activeDevice.online}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm min-h-[44px] disabled:opacity-50"
                              value={activeDevice.swing_vertical || 0}
                              onChange={(e) => updateSetting(activeDevice.mac, { swing_vertical: Number(e.target.value) })}
                            >
                              <option value={0}>Default / Full Sweep</option>
                              <option value={1}>Fixed (Highest)</option>
                              <option value={2}>Fixed (High)</option>
                              <option value={3}>Fixed (Middle)</option>
                              <option value={4}>Fixed (Low)</option>
                              <option value={5}>Fixed (Lowest)</option>
                            </select>
                          </div>
                          
                          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                            <label htmlFor={horizontalSwingId} className="block text-xs text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider mb-2">
                              Horizontal Swing
                            </label>
                            <select 
                              id={horizontalSwingId}
                              disabled={!activeDevice.online}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm min-h-[44px] disabled:opacity-50"
                              value={activeDevice.horizontal_swing || 0}
                              onChange={(e) => updateSetting(activeDevice.mac, { horizontal_swing: Number(e.target.value) })}
                            >
                              <option value={0}>Default / Full Sweep</option>
                              <option value={1}>Fixed (Far Left)</option>
                              <option value={2}>Fixed (Left)</option>
                              <option value={3}>Fixed (Center)</option>
                              <option value={4}>Fixed (Right)</option>
                              <option value={5}>Fixed (Far Right)</option>
                            </select>
                          </div>
                        </div>
                      </section>

                      {/* Features & Extras */}
                      <section aria-labelledby="features-heading">
                        <h3 id="features-heading" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                          Features & Extras
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {TOGGLES.map((toggle) => {
                            const val = activeDevice[toggle.key as keyof DeviceState];
                            const isActive = toggle.type === 'bool' ? val as boolean : (val as number) > 0;
                            const nextValue = toggle.type === 'bool' ? !isActive : (isActive ? 0 : 1);
                            
                            return (
                              <button
                                key={toggle.key}
                                type="button"
                                role="switch"
                                aria-checked={isActive}
                                aria-label={toggle.label}
                                disabled={!activeDevice.online}
                                onClick={() => updateSetting(activeDevice.mac, { [toggle.key]: nextValue })}
                                className={cn(
                                  "flex flex-col items-start justify-between p-4 rounded-2xl border transition-all text-left min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50",
                                  isActive
                                    ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-600/50 shadow-sm"
                                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-sm"
                                )}
                              >
                                <div className="flex w-full items-center justify-between mb-2">
                                  <div className={cn(
                                    "w-4 h-4 rounded-full border-2 transition-colors",
                                    isActive 
                                      ? "bg-indigo-600 border-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                      : "bg-transparent border-slate-300 dark:border-slate-600"
                                  )} />
                                </div>
                                <span className={cn(
                                  "text-sm font-bold leading-snug",
                                  isActive ? "text-indigo-950 dark:text-indigo-100" : "text-slate-700 dark:text-slate-300"
                                )}>
                                  {toggle.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </div>

                </div>
              </section>
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
