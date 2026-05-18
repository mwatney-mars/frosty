import sys
import re

path = './frontend/src/App.tsx'
with open(path, 'r') as f:
    content = f.read()

# Using a regex block replace to catch the whole horizontal list block
old_pattern = r'\{devices\.length > 0 && \(\s*<div className="mb-6 shrink-0 -mx-4 px-4 md:mx-0 md:px-0">\s*<div className="flex overflow-x-auto pb-4 gap-3 snap-x hide-scrollbar">[\s\S]*?</div>\s*</div>\s*\)\}'

new_grid_code = """{devices.length > 0 && (
              <div className="mb-6 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {devices.map(device => (
                    <button
                      key={device.ip}
                      onClick={() => setSelectedIp(device.ip)}
                      className={cn(
                        "flex flex-col justify-between aspect-[4/3] sm:aspect-square p-4 rounded-2xl border text-left transition-all duration-200 w-full relative overflow-hidden",
                        selectedIp === device.ip
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-md shadow-indigo-100 dark:shadow-none ring-1 ring-indigo-500 scale-[0.98]"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-90 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0", 
                          device.power ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-300 dark:bg-slate-600"
                        )} />
                        
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium text-sm">
                          <Thermometer className="w-3.5 h-3.5" />
                          {device.current_temperature}°
                        </div>
                      </div>
                      
                      <div className="w-full">
                        <span className={cn(
                          "font-bold block truncate text-base md:text-lg mb-0.5",
                          selectedIp === device.ip ? "text-indigo-900 dark:text-indigo-100" : "text-slate-700 dark:text-slate-200"
                        )}>
                          {device.name || 'Gree AC'}
                        </span>
                        
                        <span className={cn(
                          "text-xs font-medium truncate block",
                          device.power ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                        )}>
                          {device.power ? f"Cooling to {device.target_temperature}°" : 'Standby'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}"""

content = re.sub(old_pattern, new_grid_code, content)

with open(path, 'w') as f:
    f.write(content)
