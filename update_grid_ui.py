import sys
import re

path = './frontend/src/App.tsx'
with open(path, 'r') as f:
    content = f.read()

# First, ensure Snowflake is imported
if "Snowflake" not in content:
    content = content.replace("Sun,", "Sun, Snowflake,")

# Regex to find the button rendering
old_pattern = r'className=\{\s*cn\(\s*"flex flex-col justify-between aspect-\[4/3\] sm:aspect-square p-4 rounded-2xl border text-left transition-all duration-200 w-full relative overflow-hidden",[\s\S]*?\)\s*\}\s*>\s*<div className="flex justify-between items-start w-full">[\s\S]*?</div>\s*</button>'

# New rich UI for the tile
new_button_code = """className={cn(
                        "flex flex-col justify-between aspect-square p-5 rounded-[1.25rem] border text-left transition-all duration-200 w-full relative overflow-hidden group",
                        selectedIp === device.ip
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-md shadow-indigo-100 dark:shadow-none ring-1 ring-indigo-500 scale-[0.98]"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-90 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
                      )}
                    >
                      {/* Top Row: Power Dot & Current Temp */}
                      <div className="flex justify-between items-start w-full z-10">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0 transition-colors", 
                          device.power ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-600"
                        )} />
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold text-sm bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md">
                          {device.current_temperature}°
                        </div>
                      </div>
                      
                      {/* Middle: Big Center Icon representing state */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 dark:opacity-20 transition-opacity group-hover:opacity-20 dark:group-hover:opacity-30">
                        {device.power ? (
                           device.mode === 1 ? <Snowflake className="w-16 h-16 text-blue-500" strokeWidth={1.5} /> :
                           device.mode === 2 ? <Droplets className="w-16 h-16 text-cyan-500" strokeWidth={1.5} /> :
                           device.mode === 3 ? <Fan className="w-16 h-16 text-teal-500" strokeWidth={1.5} /> :
                           device.mode === 4 ? <Sun className="w-16 h-16 text-orange-500" strokeWidth={1.5} /> :
                           <Thermometer className="w-16 h-16 text-indigo-500" strokeWidth={1.5} />
                        ) : (
                           <Power className="w-16 h-16 text-slate-400" strokeWidth={1.5} />
                        )}
                      </div>
                      
                      {/* Bottom Row: Name & Target State */}
                      <div className="w-full z-10">
                        <span className={cn(
                          "font-bold block truncate text-base md:text-[1.1rem] mb-1 leading-tight",
                          selectedIp === device.ip ? "text-indigo-900 dark:text-indigo-100" : "text-slate-800 dark:text-slate-100"
                        )}>
                          {device.name || 'Gree AC'}
                        </span>
                        
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs font-semibold truncate w-full rounded-md px-1.5 py-1 -ml-1.5 transition-colors",
                          device.power 
                             ? (selectedIp === device.ip ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400")
                             : "text-slate-400 dark:text-slate-500 bg-transparent"
                        )}>
                          {device.power ? (
                             <>
                               {device.mode === 1 ? <Snowflake className="w-3.5 h-3.5" /> : 
                                device.mode === 2 ? <Droplets className="w-3.5 h-3.5" /> : 
                                device.mode === 3 ? <Fan className="w-3.5 h-3.5" /> : 
                                device.mode === 4 ? <Sun className="w-3.5 h-3.5" /> : 
                                <Thermometer className="w-3.5 h-3.5" />}
                               <span>Set to {device.target_temperature}°</span>
                             </>
                          ) : 'Standby'}
                        </div>
                      </div>
                    </button>"""

content = re.sub(old_pattern, new_button_code, content)

with open(path, 'w') as f:
    f.write(content)
