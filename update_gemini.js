const fs = require('fs');
const path = './GEMINI.md';

let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '- **Persistence:** `users.json` (JSON-based user database).',
  '- **Persistence:** SQLite (`frosty.db`) via SQLAlchemy (User accounts and custom device names).'
);

content = content.replace(
  '- `backend/app/`: FastAPI application logic.',
  '- `backend/app/`: FastAPI application logic.\n    - `database.py`: SQLAlchemy configuration and models.'
);

content = content.replace(
  '- **Custom Device Names:** Admin users can rename devices. These names are persisted across server reboots via a `device_names.json` file.',
  '- **Custom Device Names:** Admin users can rename devices. These names are persisted across server reboots in the SQLite database.'
);

content = content.replace(
  '- Basic discovery, control, and user management are implemented.',
  '- Basic discovery, control, and user management are implemented.\n- **New:** The frontend includes a Weather Widget (via Open-Meteo) and is fully installable as a PWA (Progressive Web App).\n- **New:** Backend persistence has been upgraded to SQLite.'
);

fs.writeFileSync(path, content);
