const fs = require('fs');
const path = './frontend/src/App.tsx';

let content = fs.readFileSync(path, 'utf8');

// The naive revert missed these exact patterns, let's fix them manually
content = content.replace(/d\.mac === mac/g, 'd.ip === ip');
content = content.replace(/updateDevice\(mac,/g, 'updateDevice(ip,');
content = content.replace(/setEditingIp\(mac\);/g, 'setEditingIp(ip);');
// Check if updateSetting signature is fully correct
content = content.replace(/const updateSetting = async \(ip: string, updates: Partial<DeviceState>\) => \{/g, 'const updateSetting = async (ip: string, updates: Partial<DeviceState>) => {');

fs.writeFileSync(path, content);
