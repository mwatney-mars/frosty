import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users as UsersIcon, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Wind,
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { 
  deleteDevice, 
  discoverDevices, 
  saveDevice, 
  type DiscoveredDevice 
} from './api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDevices } from './DeviceContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ViewState = 'menu' | 'devices';

export default function Settings() {
  const { devices, initialized, error, setError, refreshDevices } = useDevices();
  const [view, setView] = useState<ViewState>('menu');
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [addingMacs, setAddingMacs] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Auto-scan when entering the devices view
  useEffect(() => {
    if (view === 'devices') {
      handleScan();
    }
  }, [view]);

  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const data = await discoverDevices();
      setDiscovered(data);
    } catch (err) {
      setError('Scan failed. Ensure backend is reachable.');
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = async (device: DiscoveredDevice) => {
    setAddingMacs(prev => new Set(prev).add(device.mac));
    try {
      await saveDevice(device.mac, device.name, device.ip);
      setDiscovered(prev => prev.filter(d => d.mac !== device.mac));
      await refreshDevices();
    } catch (err) {
      alert('Failed to add device');
    } finally {
      setAddingMacs(prev => {
        const next = new Set(prev);
        next.delete(device.mac);
        return next;
      });
    }
  };

  const handleDelete = async (mac: string) => {
    if (!confirm('Are you sure you want to remove this device from your dashboard?')) return;
    try {
      await deleteDevice(mac);
      await refreshDevices();
    } catch (err) {
      alert('Failed to delete device');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => view === 'menu' ? navigate('/') : setView('menu')}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{view === 'menu' ? 'Configuration' : 'Device Management'}</h1>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {view === 'menu' ? (
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => setView('devices')}
              className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                  <Wind className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Device Management</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add, remove, or scan for AC units on your network.</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </button>

            <button 
              onClick={() => navigate('/users')}
              className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">User Management</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage user accounts and administrator permissions.</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </button>

            <div className="mt-8 text-center text-slate-500 dark:text-slate-400">
              <p className="font-medium text-sm">Frosty Smart AC Controller</p>
              <p className="font-mono text-xs mt-1">Version 1.0.12</p>
            </div>

          </div>
        ) : (
          <>
            {/* Saved Devices Section */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  Saved Devices
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full">
                  {devices.length} Total
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                {!initialized ? (
                  <div className="p-10 text-center text-slate-500 italic">Loading saved devices...</div>
                ) : devices.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-slate-500 mb-2">No devices saved yet.</p>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Use the scan tool below</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {devices.map(device => (
                      <div key={device.mac} className="p-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            device.online ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600"
                          )}>
                            <Wind className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{device.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{device.mac} • {device.online ? device.ip : 'OFFLINE'}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDelete(device.mac)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Remove device"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Discovery Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <RefreshCw className={cn("w-5 h-5 text-indigo-600", scanning && "animate-spin")} />
                  Add New Devices
                </h2>
                <button 
                  onClick={handleScan}
                  disabled={scanning}
                  className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  {scanning ? 'Scanning...' : 'Scan Again'}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                {discovered.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-sm">
                    {scanning ? 'Searching for Gree units...' : 'No new devices found on your network.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {discovered.map(device => (
                      <div key={device.mac} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
                            <Plus className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{device.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{device.mac} • {device.ip}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAdd(device)}
                          disabled={addingMacs.has(device.mac)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          {addingMacs.has(device.mac) ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Adding...</span>
                            </>
                          ) : 'Add to Dashboard'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
}
