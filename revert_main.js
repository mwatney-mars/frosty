const fs = require('fs');
const path = './backend/app/main.py';

let content = fs.readFileSync(path, 'utf8');

// Revert main.py endpoints
content = content.replace(/mac: str/g, 'ip: str');
content = content.replace(/\{mac\}/g, '{ip}');
content = content.replace(/\(mac,/g, '(ip,');

// In DeviceState BaseModel remove mac: str
content = content.replace(/    mac: str\n/g, '');

fs.writeFileSync(path, content);
