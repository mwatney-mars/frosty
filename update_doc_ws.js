const fs = require('fs');
const path = './GEMINI.md';

let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '- Frontend polls `/api/devices` every 5 seconds for state updates.',
  '- Frontend connects to `ws://.../api/ws` to receive instant real-time state broadcasts, eliminating the need for client-side polling.'
);

content = content.replace(
  '- **New:** Backend persistence has been upgraded to SQLite.',
  '- **New:** Backend persistence has been upgraded to SQLite.\n- **New:** WebSockets implemented for real-time device status syncing across all clients.'
);

fs.writeFileSync(path, content);
