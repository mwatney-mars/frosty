import sys
import re

path = './frontend/src/App.tsx'
with open(path, 'r') as f:
    content = f.read()

# Make sure Power is imported if we are using it
if "Power," not in content and " Power " not in content:
    content = content.replace("Sun, Snowflake,", "Sun, Snowflake, Power,")

old_pattern = r'<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">[\s\S]*?</button>\s*\)\)\}\s*</div>'

new_grid_code = """<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
                              {device.power ? f"To {device.target_temperature}°" : 'Standby'}
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
                </div>"""

content = re.sub(old_pattern, new_grid_code, content)

with open(path, 'w') as f:
    f.write(content)
