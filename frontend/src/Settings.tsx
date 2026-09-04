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
import { useToast } from './ToastContext';
import { ConfirmModal } from './components/Modal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ViewState = 'menu' | 'devices';

export default function Settings() {
  const { devices, initialized, error, setError, refreshDevices } = useDevices();
  const { showToast } = useToast();
  const [view, setView] = useState<ViewState>('menu');
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [addingMacs, setAddingMacs] = useState<Set<string>>(new Set());
  
  // Confirm deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<{ mac: string; name: string } | null>(null);

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
      if (data.length === 0) {
        showToast('No new devices found on network', 'info');
      } else {
        showToast(`Found ${data.length} new AC unit(s)`, 'success');
      }
    } catch (err) {
      setError('Scan failed. Ensure backend is reachable.');
      showToast('Scan failed', 'error');
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

  const promptDelete = (mac: string, name: string) => {
    setDeviceToDelete({ mac, name });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deviceToDelete) return;
    try {
      await deleteDevice(deviceToDelete.mac);
      await refreshDevices();
      showToast(`Removed ${deviceToDelete.name} from dashboard`, 'success');
    } catch (err) {
      showToast('Failed to delete device', 'error');
    } finally {
      setDeleteModalOpen(false);
      setDeviceToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        
        {/* Confirm Delete Modal */}
        <ConfirmModal
          isOpen={deleteModalOpen}
          title="Remove AC Device?"
          message={`Are you sure you want to remove "${deviceToDelete?.name || 'this device'}" from your dashboard? You can re-add it at any time via network scan.`}
          confirmText="Remove Device"
          cancelText="Cancel"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setDeviceToDelete(null);
          }}
        />

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => view === 'menu' ? navigate('/') : setView('menu')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={view === 'menu' ? "Return to dashboard" : "Return to settings menu"}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {view === 'menu' ? 'Configuration' : 'Device Management'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {view === 'menu' ? 'System settings and user accounts' : 'Scan, pair, and configure your Gree AC units'}
            </p>
          </div>
        </header>

        {error && (
          <div 
            className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-200 flex items-center gap-3"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {view === 'menu' ? (
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => setView('devices')}
              className="group bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all text-left flex items-center justify-between min-h-[96px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Wind className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Device Management</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">Add, remove, or scan for Gree AC units on your network.</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
            </button>

            <button 
              onClick={() => navigate('/users')}
              className="group bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all text-left flex items-center justify-between min-h-[96px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                  <UsersIcon className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Management</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">Manage user credentials and administrator access permissions.</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
            </button>

            <div className="mt-8 text-center text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">Frosty Smart AC Controller</p>
              <p className="font-mono text-xs mt-1 text-slate-500 dark:text-slate-400">Version 1.1.1</p>
            </div>

          </div>
        ) : (
          <>
            {/* Saved Devices Section */}
            <section aria-labelledby="saved-devices-heading" className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 id="saved-devices-heading" className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Saved Devices
                </h2>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                  {devices.length} Total
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                {!initialized ? (
                  <div className="p-10 text-center text-slate-500 italic">Loading saved devices...</div>
                ) : devices.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">No devices saved yet.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Use the discovery tool below to add units</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {devices.map(device => (
                      <div key={device.mac} className="p-4 md:p-5 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                            device.online 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" 
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          )}>
                            <Wind className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white leading-tight truncate">{device.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                              {device.mac} • {device.online ? device.ip : <span className="text-rose-600 dark:text-rose-400 font-bold uppercase">Offline</span>}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => promptDelete(device.mac, device.name || 'Gree AC')}
                          className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          aria-label={`Remove ${device.name || 'device'} from dashboard`}
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
            <section aria-labelledby="discovery-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="discovery-heading" className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <RefreshCw className={cn("w-5 h-5 text-indigo-600 dark:text-indigo-400", scanning && "animate-spin")} />
                  Discover New Devices
                </h2>
                <button 
                  onClick={handleScan}
                  disabled={scanning}
                  className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 min-h-[44px] flex items-center px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
                >
                  {scanning ? 'Searching...' : 'Scan Network'}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                {discovered.length === 0 ? (
                  <div className="p-10 text-center text-slate-600 dark:text-slate-300 text-sm">
                    {scanning ? 'Searching local network for Gree AC units...' : 'No new unconfigured devices found on your network.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {discovered.map(device => (
                      <div key={device.mac} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Plus className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white leading-tight truncate">{device.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">{device.mac} • {device.ip}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAdd(device)}
                          disabled={addingMacs.has(device.mac)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          {addingMacs.has(device.mac) ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
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
