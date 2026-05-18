const fs = require('fs');
const path = './frontend/src/App.tsx';

let content = fs.readFileSync(path, 'utf8');

// Reverse state variables
content = content.replace(/selectedMac/g, 'selectedIp');
content = content.replace(/setSelectedMac/g, 'setSelectedIp');
content = content.replace(/editingMac/g, 'editingIp');
content = content.replace(/setEditingMac/g, 'setEditingIp');

// Reverse activeDevice lookup
content = content.replace(/devices\.find\(d => d\.mac === selectedIp\)/g, 'devices.find(d => d.ip === selectedIp)');
content = content.replace(/devices\[0\]\.mac/g, 'devices[0].ip');

// Reverse device.mac map keys and other refs
content = content.replace(/key=\{device\.mac\}/g, 'key={device.ip}');
content = content.replace(/device\.mac/g, 'device.ip');
content = content.replace(/activeDevice\.mac/g, 'activeDevice.ip');

// Function params
content = content.replace(/\(mac: string,/g, '(ip: string,');
content = content.replace(/const updateSetting = async \(ip: string,/g, 'const updateSetting = async (ip: string,');
content = content.replace(/d\.mac === ip/g, 'd.ip === ip');
content = content.replace(/updateDevice\(ip,/g, 'updateDevice(ip,');
content = content.replace(/startEditingName\(activeDevice.ip,/g, 'startEditingName(activeDevice.ip,');

fs.writeFileSync(path, content);
