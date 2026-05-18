const fs = require('fs');
const path = './frontend/src/App.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace state variables
content = content.replace(/selectedIp/g, 'selectedMac');
content = content.replace(/setSelectedIp/g, 'setSelectedMac');
content = content.replace(/editingIp/g, 'editingMac');
content = content.replace(/setEditingIp/g, 'setEditingMac');

// Replace activeDevice lookup
content = content.replace(/devices\.find\(d => d\.ip === selectedMac\)/g, 'devices.find(d => d.mac === selectedMac)');
content = content.replace(/devices\[0\]\.ip/g, 'devices[0].mac');

// Replace device.ip map keys and other refs
content = content.replace(/key=\{device\.ip\}/g, 'key={device.mac}');
content = content.replace(/device\.ip/g, 'device.mac');
content = content.replace(/activeDevice\.ip/g, 'activeDevice.mac');

// Function params
content = content.replace(/\(ip: string,/g, '(mac: string,');
content = content.replace(/const updateSetting = async \(ip: string,/g, 'const updateSetting = async (mac: string,');
content = content.replace(/d\.ip === ip/g, 'd.mac === mac');
content = content.replace(/updateDevice\(ip,/g, 'updateDevice(mac,');
content = content.replace(/startEditingName\(activeDevice.mac,/g, 'startEditingName(activeDevice.mac,');

fs.writeFileSync(path, content);
