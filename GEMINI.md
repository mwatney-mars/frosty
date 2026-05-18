# Frosty: Smart AC Controller

A web-based controller for Gree Air Conditioning units, featuring a FastAPI backend and a React/TypeScript frontend.

## Tech Stack
- **Backend:** Python 3.13, FastAPI, `greeclimate` (device communication), `python-jose` (JWT), `bcrypt` (password hashing).
- **Frontend:** React 19, TypeScript, Vite, `lucide-react` (icons), Tailwind CSS (for styling).
- **Persistence:** SQLite (`frosty.db`) via SQLAlchemy (User accounts and custom device names).

## Project Structure
- `backend/app/`: FastAPI application logic.
    - `database.py`: SQLAlchemy configuration and models.
    - `main.py`: Entry point, API routes, and static file serving.
    - `gree_manager.py`: Discovery and control logic using `greeclimate`.
    - `auth.py`: Authentication, JWT, and user management.
- `frontend/src/`: React source code.
    - `App.tsx`: Main dashboard and device control UI.
    - `api.ts`: API client and interface definitions.
    - `Login.tsx` / `Users.tsx`: Auth and Admin pages.
- `run.sh`: Main startup script for manual execution.
- `Dockerfile` & `.dockerignore`: Multi-stage build for containerized deployments.
- `CLOUD.md`: Instructions for remote access via Cloudflare Tunnels.

## Core Workflows
1. **Authentication:**
    - Uses JWT (JSON Web Tokens) stored in `localStorage`.
    - Default credentials: `admin` / `admin`.
    - Admin users can manage other users via the UI.
2. **Device Discovery:**
    - Background discovery starts on backend startup.
    - Uses UDP broadcast (or explicit IPs via `GREE_IPS` env var).
    - Devices must be "bound" (`device.bind()`) before they can be controlled.
    - Devices are tracked by their IP address for control routing.
3. **Device Control & Persistence:**
    - Frontend connects to `ws://.../api/ws` to receive instant real-time state broadcasts, eliminating the need for client-side polling.
    - Control commands (power, temp, mode, etc.) are sent via PATCH requests to `/api/devices/{ip}`.
    - **Custom Device Names:** Admin users can rename devices. These names are persisted across server reboots in the SQLite database. The backend silently tracks the MAC address to maintain the correct name even if the IP changes via DHCP.

## Conventions
- **API Prefix:** All backend API routes are prefixed with `/api/`.
- **Frontend Build:** The backend serves the frontend from `frontend/dist`.
- **Styling:** Use Tailwind-style utility classes.

## Current Status
- Basic discovery, control, and user management are implemented.
- **Completed:** The frontend includes a Weather Widget (via Open-Meteo) and is fully installable as a PWA (Progressive Web App).
- **Completed:** Backend persistence has been upgraded to SQLite.
- **Completed:** WebSockets implemented for real-time device status syncing across all clients.
- **Completed:** Shared Theme State via React Context.
- **Completed:** Project is fully containerized with a multi-stage Dockerfile and ready for GitHub distribution.

## Security & Remote Access
- Secure remote access documentation is available in `CLOUD.md`.
